---
status: complete
priority: p3
issue_id: "183"
tags: [code-review, mobile, security, validation]
dependencies: []
---

# Year input accepts non-numeric via paste; custom make/model lacks maxLength

## Fix
- Add onChangeText filter in YearInput: onChange(value.replace(/\D/g, ''))
- Add maxLength={50} to custom make name and model TextInputs
- Log only error.message in personalizing.tsx:176, not raw error object
