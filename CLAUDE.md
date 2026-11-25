# Workflow: ship straight to `main`

All code in this repo goes live as soon as it lands on `main`. Nobody reviews or merges
PRs by hand, so every coding session must finish the job itself.

## Rules for every session

1. **Start from the latest `main`.** Before coding: `git fetch origin main` and base your
   work on `origin/main` (rebase/merge it into your working branch if it is behind).
2. **Run the tests** (`npm test`, if defined in `package.json`) before shipping. Don't
   push broken code to `main`.
3. **When you finish coding, merge to `main` automatically — don't ask, don't stop at a PR:**
   ```bash
   git fetch origin main
   git rebase origin/main          # or: git merge origin/main
   git push origin HEAD:main       # fast-forward main with your commits
   ```
   If the push is rejected because `main` moved, fetch, rebase again, and retry.
4. **If the platform requires you to work on a designated branch** (e.g. `claude/...`),
   commit and push there too, then also push to `main` as above. If branch protection
   blocks the direct push, open a PR and enable auto-merge / merge it yourself
   (squash is fine) rather than leaving it open.
5. **Never leave finished work unmerged.** Don't force-push `main`, and don't rewrite
   history that is already on `main`.
6. Mention in your final message that the change has been merged to `main` (and is live).
