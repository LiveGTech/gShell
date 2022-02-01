# Authentication mechanism
LiveG OS features a secure method of authentication which incorporates a defensive design strategy to ensure that only authorised users have access to the system, as set out in the [design of LiveG OS's architecture](architecture.md).

Within LiveG OS, each user is given their own authentication credentials which contain an array of authentication methods for which the user can be authenticated by. This allows for free choice by the user as to how they wish to be primarily authenticated, while providing fallback methods if one method is unauthenticatable (such as if a biometric authentication method is not working due to being in a suboptimal environment, such as a dark room for face recognition).

Secure, cryptographically-sound hashing is used where possible to secure the authentication credentials which users use, which is beneficial if the user happens to use the same authentication credentials to access multiple devices and platforms. Without hashing, if an attacker manages to access the user's credentials, they would be able to obtain the data needed to potentially access various platforms. With hashing, this is practically impossible with present-day methods of hashed data retrieval.

The hashing function used within LiveG OS's authentication mechanism is bcrypt due to its widespread notoriety as being a secure function for hashing sensitive data, such as passwords. It includes a cryptographically-secure randomly-generated salt within the hash to mitigate rainbow table attacks.

Some authentication methods may include an _unauthenticated timeout_ — a timeout which is imposed when authentication fails (for example, if the user enters an incorrect password). This is to mitigate brute-force attacks or otherwise make them inconvenient to perform by increasing the time taken to perform an attack.

## List of authentication methods

| Method identifier    | Type          | Uses hashing? | Domain (for lock screen)        | Timeout        |
|----------------------|---------------|---------------|---------------------------------|----------------|
| `UnsecureAuthMethod` | Public access | ❌ No         | ∅ (empty set)                   | Not applicable |
| `PasswordAuthMethod` | Secret-based  | ✔️ Yes        | {regular expression `/[^\n]+/`} |       1,000 ms |
| `PasscodeAuthMethod` | Secret-based  | ✔️ Yes        | {regular expression `/d+/`}     |       1,000 ms |