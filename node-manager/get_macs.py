import subprocess
import shlex
import yaml
import json
import re

var_file = "run/config/vars/0101_bootstrap.yml"
mac_file = "run/config/vars/mac_addrs.json"

# get the compute instance names from the var file
def get_vm_names():
    yaml_file = open(var_file)
    parsed_yaml_file = yaml.load(yaml_file, Loader=yaml.FullLoader)
    vm_names = list(map(lambda elem: (elem.get('machine_name')),
                                    parsed_yaml_file.get('machines')))
    return vm_names


def gcloud_ssh_cmd(vm_name, cmd):
    cmd_ssh = "gcloud compute ssh {}".format(vm_name)

    process = subprocess.run(shlex.split(cmd_ssh + cmd),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True) # so the output is not of type bytes

    return process.stdout


def get_ip(cmd_result):
    ip_addr = ''
    ip_regex = '(?:[0-9]{1,3}\.){3}[0-9]{1,3}'
    for line in cmd_result.splitlines():
        if "inet" in line:
            ip_addr = re.findall(ip_regex, line)
            break

    # the second one is the broadcast address
    return ip_addr[0]


# outputs the MAC addrs of the VMs to a JSON file
def get_mac_addrs(vm_names):

    output_list = []

    for vm_name in vm_names:
        vm_dict = {"name" : vm_name, "networkInterfaces": [] }
        cmd_get_mac = " --command='find /sys/class/net/ -type l -printf \"%P: \" -execdir cat {}/address \;'"

        cmd_result = gcloud_ssh_cmd(vm_name, cmd_get_mac)
        output_lines = cmd_result.splitlines()
        for line in output_lines:
            addr = line.split(':', 1)
            if addr[0] != 'lo':
                # get the IP addr as well to be able to differenciate between
                # the management and internal network
                cmd_get_ip = " --command='ip -4 addr show {interface}'".format(interface = addr[0])
                cmd_result = gcloud_ssh_cmd(vm_name, cmd_get_ip)
                ip_addr = get_ip(cmd_result)
                vm_dict["networkInterfaces"].append( { "name" : addr[0], "ip_addr" : ip_addr, "mac_addr" : addr[1].lstrip() } )

        output_list.append(vm_dict)

        # dump data to json file
        with open(mac_file, "w") as outfile:
            json.dump(output_list, outfile)


def main():
    vm_names = get_vm_names()
    get_mac_addrs(vm_names)


if __name__ == '__main__':
    main()
