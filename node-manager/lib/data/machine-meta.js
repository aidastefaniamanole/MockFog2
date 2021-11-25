const fs = require("fs");
const stripJson = require("strip-json-comments");

const conf = require("../config.js")

/**
 * Returns the instance object that has a name field which is equal to the given machine_name.
 * Returns undefined if no such instance exists.
 *
 * @param {Object} machine_name
 * @param {Object} instances the machine meta json instances object
 */
 function getInstance(machine_name, instances) {
    for (const instance of instances) {
        if (instance.name === machine_name) {
            return instance
        }
    }
}


/**
 * Returns the private ip address of the internal communication network.
 * These IPs are part of the 10.0.2.0/24 subnet.
 *
 * @param {String} machine_name
 * @param {Object} instances the machine meta json instances object
 */
 function getInternalIP(machine_name, instances) {
    const network_interfaces = getInstance(machine_name, instances).networkInterfaces

    for (const network_interface of network_interfaces) {
        const ip = network_interface.networkIP
        if (ip.startsWith("10.0.2.")) {
            return ip
        }
    }
}


/**
 * Returns the public ip address of the management communication network.
 *
 * @param {String} machine_name
 * @param {Object} instances the machine meta json instances object
 */
 function getPublicIP(machine_name, instances) {
    const network_interfaces = getInstance(machine_name, instances).networkInterfaces

    for (const network_interface of network_interfaces) {
        const ip = network_interface.networkIP
        if (ip.startsWith("10.0.1.")) {
            return network_interface.accessConfigs[0].natIP
        }
    }
}


/**
 * Returns the machine name of the machine with the given public_ip.
 * 
 * @param {String} public_ip
 * @param {Object} instances the machine meta json instances object
 */
 function getMachineNameFromPublicIp(public_ip, instances) {
    for (const instance of instances) {
        if (instance.networkInterfaces[0].accessConfigs[0].natIP === public_ip ||
            instance.networkInterfaces[1].accessConfigs[0].natIP === public_ip) {
            return instance.name
        }
    }
}


/**
 * Returns the netplan string
 * @param {String} machine_name
 * @param {Object} instances the machine meta json instances object
 */

 function getNetplanString(machine_name) {
    // get mac addresses
    const addresses = {}
    
    fileLocation = conf.runConfigDir + "vars/mac_addrs.json"
    const infraJson = fs.readFileSync(fileLocation, "utf-8")
    const stripped = stripJson(infraJson)
    
    try {
        var vm_macs = JSON.parse(stripped)

        for (const vm of vm_macs) {
            if (vm.name === machine_name) {
               for (const network_interface of vm.networkInterfaces) {
                    if (network_interface.ip_addr.startsWith("10.0.2.")) {
                        addresses["internal"] = network_interface.mac_addr
                    } else if (network_interface.ip_addr.startsWith("10.0.1.")) {
                        addresses["management"] = network_interface.mac_addr
                    }
               }
            }
        }

        console.log("ADRESSES", addresses)

        return `network:
        ethernets:
            ens4:
                dhcp4: true
                dhcp6: false
                match:
                    macaddress: ${addresses["management"]}
                set-name: ens4
            ens5:
                dhcp4: true
                dhcp6: false
                match:
                    macaddress: ${addresses["internal"]}
                set-name: ens5
        version: 2
        `
    } catch (error) {
        logger.error(error)
        logger.error(stripped)
        process.exit(1)
    }
}


//*************************************
// Hosts file helper
//*************************************

/**
 * Returns a helper object needed to create the ansible hosts file.
 *
 * @param {Object} machineMeta the machine meta json object
 */
 function getHostsDataObject(machineMeta) {
    return {
        "machines:children": machineMeta.resources.map(i => {return i.name}).join("\n"),
        "machineGroups": machineMeta.resources.map(i => {
            return `[${i.name}]\n${i.networkInterfaces[0].accessConfigs[0].natIP} machine_name=${i.name} internal_ip=${getInternalIP(i.name, machineMeta.resources)}`
        }).join("\n\n")
    }
}

module.exports = function(fileLocation) {
    if (!fileLocation) {
        fileLocation = conf.runMachinesDir + "machine_meta.jsonc"
    }

    const machineMetaJson = fs.readFileSync(fileLocation, "utf-8")
    const machineMeta = JSON.parse(stripJson(machineMetaJson))

    return {
        machineMeta: machineMeta,
        getInternalIP: function(machine_name) {
            return getInternalIP(machine_name, machineMeta.resources)
        },
        getPublicIP: function(machine_name) {
            return getPublicIP(machine_name, machineMeta.resources)
        },
        getMachineNameFromPublicIp: function(public_ip) {
            return getMachineNameFromPublicIp(public_ip, machineMeta.resources)
        },
        getNetplanString: function(machine_name) {
            return getNetplanString(machine_name, machineMeta.resources)
        },
        hostsDataObject: getHostsDataObject(machineMeta)
    }
}
