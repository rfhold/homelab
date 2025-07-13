from pyinfra.operations import files

_ = files.replace(
    name="Enable cgroups in boot config",
    _sudo=True,
    path="/boot/firmware/cmdline.txt",
    text="$",  # Match end of line
    replace=" cgroup_enable=cpuset cgroup_memory=1 cgroup_enable=memory",  # Text to append
    backup=True,
)
