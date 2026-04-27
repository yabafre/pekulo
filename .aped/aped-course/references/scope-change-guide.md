# Scope Change Management Guide

## Impact Assessment Matrix

| Change Type | PRD | UX | Epics | Stories | Code | Severity |
|-------------|-----|-----|-------|---------|------|----------|
| New feature added | Add FRs | Add screens | New stories | Create | None | Minor |
| Feature removed | Remove FRs | Remove screens | Archive stories | Archive | May delete | Minor |
| FR modified | Update FR | May update | Update story ACs | Update | May refactor | Medium |
| Architecture change | Update NFRs | May rebuild | Update all Dev Notes | Reset | May rewrite | Major |
| Priority reorder | No change | No change | Reorder | Reset status | None | Minor |
| Complete pivot | Restart | Restart | Restart | Restart | Archive | Critical |

## Change Process

### Step 1: Document the Change
- What changed and why
- Who requested it (user, stakeholder, technical discovery)
- Date of change

### Step 2: Impact Analysis
- List all affected artifacts (PRD sections, stories, code files)
- Classify severity (minor/medium/major/critical)
- Estimate effort to apply change

### Step 3: User Confirmation
- Present impact summary to user
- Get explicit "proceed" before making changes
- For major/critical: warn about in-progress work loss

### Step 4: Execute Change
- Archive affected artifacts to `{output}/archive/{date}/`
- Apply changes top-down (PRD → UX → Epics → Stories)
- Re-validate at each level (scripts)
- Update state.yaml

### Step 5: Verify Consistency
- FR coverage still 100%
- No orphan stories
- No broken dependencies
- State reflects new reality

## Scope Creep Detection

Warning signs:
- Total FRs grew >20% from original PRD
- Epic count increased
- Stories consistently exceed single-session size
- "Just one more thing" pattern repeating

Response:
- Flag to user with metrics
- Suggest moving additions to Growth phase
- Enforce MVP discipline
