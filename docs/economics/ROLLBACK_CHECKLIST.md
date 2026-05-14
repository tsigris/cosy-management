# Economics Rollback Checklist

- [ ] Confirm incident scope
- [ ] Disable feature flag if present
- [ ] Revert the smallest offending change
- [ ] Keep old routes available
- [ ] Preserve canonical finance semantics
- [ ] Run route smoke
- [ ] Run canonical regression tests if finance-adjacent
- [ ] Verify user-facing recovery
- [ ] Record root cause and follow-up
