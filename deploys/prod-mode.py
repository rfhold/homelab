from pyinfra.operations import files

user = "rfhold"

_ = files.line(
    _sudo=True,
    name="Add {} as a sudo user without NOPASSWD".format(user),
    path="/etc/sudoers",
    line=r"{} .*".format(user),
    replace="{} ALL=(ALL) ALL".format(user),
)
