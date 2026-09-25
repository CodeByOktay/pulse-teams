---
name: protect-tests-and-migrations
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: (^|[\\/])(src[\\/]lib[\\/]__tests__|prisma[\\/]migrations)([\\/]|$)
---

Access Denied: This path is protected by project policy. Test files and migration history are owned by Antigravity and cannot be modified by Claude. Fix production code instead.
