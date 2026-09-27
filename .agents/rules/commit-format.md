---
trigger: model_decision
---


Before creating commits:

1. Run git diff analysis.
2. Identify feature boundaries.
3. Identify architecture changes.
4. Identify documentation changes.
5. Identify test changes.
6. Identify infrastructure changes.

Commit priority:

1. Schema changes
2. Backend logic
3. Frontend UI
4. Tests
5. Documentation
6. CI/CD
7. Refactoring

Never combine multiple layers in one commit unless they are inseparable.

Each commit should answer:

"What business or technical objective does this commit achieve?"

Generate Conventional Commits only.

Allowed types:

feat
fix
refactor
test
docs
chore
build
ci
perf

Reject generic commit messages.
