import os
import privy

def get_secret(encrypted_secret):
    password = os.environ['HOST_SECRETS_PASSWORD']
    return privy.peek(encrypted_secret, password).decode("utf-8")
