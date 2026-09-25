---
name: protect-tests-and-migrations-bash
enabled: true
event: bash
action: block
conditions:
  - field: command
    operator: regex_match
    pattern: (src[\\/]+lib[\\/]+__tests__|prisma[\\/]+migrations)
  - field: command
    operator: regex_match
    pattern: (?<![0-9&=-])>>?(?!&)(?!\s*(/dev/null|nul\b))|\b(sed\s+(-\w*i|--in-place)|perl\s+-\w*i|tee|rm|rmdir|del|erase|mv|move|ren|rename|cp|copy|touch|truncate|Remove-Item|Move-Item|Copy-Item|Rename-Item|New-Item|Set-Content|Add-Content|Clear-Content|Out-File)\b|\bgit\s+(checkout|restore|rm|mv|reset|clean|apply|stash|revert|cherry-pick|merge|rebase|pull)\b
---

Access Denied: This path is protected by project policy. Test files and migration history are owned by Antigravity and cannot be modified by Claude. Fix production code instead.
