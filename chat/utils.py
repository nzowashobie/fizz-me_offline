# utils.py
import os
import base64
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

def generate_aes_key():
    """Generate a secure 256-bit (32-byte) AES key and return it as a base64-encoded string."""
    aes_key = os.urandom(32)  # Generate a 32-byte (256-bit) key
    return base64.b64encode(aes_key).decode()  # Encode the key in base64 for storage

def encrypt_aes_gcm(plaintext, key):
    """Encrypt data using AES-GCM."""
    key = base64.b64decode(key)  # Decode the base64-encoded key
    nonce = os.urandom(12)  # 96-bit nonce for GCM
    cipher = Cipher(algorithms.AES(key), modes.GCM(nonce), backend=default_backend())
    encryptor = cipher.encryptor()
    ciphertext = encryptor.update(plaintext.encode()) + encryptor.finalize()
    return nonce, ciphertext, encryptor.tag

def decrypt_aes_gcm(nonce, ciphertext, tag, key):
    """Decrypt data using AES-GCM."""
    key = base64.b64decode(key)  # Decode the base64-encoded key
    cipher = Cipher(algorithms.AES(key), modes.GCM(nonce, tag), backend=default_backend())
    decryptor = cipher.decryptor()
    return decryptor.update(ciphertext) + decryptor.finalize()

def encrypt_message(plaintext):
    """Encrypt a message using AES-GCM."""
    key = generate_aes_key()  # Generate a new AES key
    nonce, ciphertext, tag = encrypt_aes_gcm(plaintext, key)
    return {
        "ciphertext": base64.b64encode(ciphertext).decode(),
        "nonce": base64.b64encode(nonce).decode(),
        "tag": base64.b64encode(tag).decode(),
        "key": key,  # Return the base64-encoded key
    }

def decrypt_message(encrypted_data):
    """Decrypt a message using AES-GCM."""
    ciphertext = base64.b64decode(encrypted_data["ciphertext"])
    nonce = base64.b64decode(encrypted_data["nonce"])
    tag = base64.b64decode(encrypted_data["tag"])
    key = encrypted_data["key"]  # Retrieve the base64-encoded key
    return decrypt_aes_gcm(nonce, ciphertext, tag, key).decode()