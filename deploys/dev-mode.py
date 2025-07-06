from pyinfra.operations import files

user = "rfhold"

_ = files.line(
    _sudo=True,
    name="Add {} as a passwordless sudo user".format(user),
    path="/etc/sudoers",
    line=r"{} .*".format(user),
    replace="{} ALL=(ALL) NOPASSWD: ALL".format(user),
)
