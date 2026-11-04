"""Shared AES-256-GCM envelope. Associated data is compact UTF-8 JSON [provider, owner]."""
import base64
import json
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def aad(provider, owner):
    return json.dumps([provider, owner], ensure_ascii=False, separators=(",", ":")).encode()


def seal(secret, provider, owner, key, version=1):
    nonce = os.urandom(12)
    encrypted = AESGCM(base64.b64decode(key, validate=True)).encrypt(nonce, secret.encode(), aad(provider, owner))
    return dict(ciphertext=base64.b64encode(encrypted[:-16]).decode(), iv=base64.b64encode(nonce).decode(),
                tag=base64.b64encode(encrypted[-16:]).decode(), key_version=version, key_hint=secret[-4:])


def unseal(envelope, provider, owner, keys):
    key = keys[envelope["key_version"]]
    encrypted = base64.b64decode(envelope["ciphertext"]) + base64.b64decode(envelope["tag"])
    return AESGCM(base64.b64decode(key)).decrypt(base64.b64decode(envelope["iv"]), encrypted, aad(provider, owner)).decode()
