# Check, analyze and solve the GitHub issue

## About

Check GitHub issue by running `gh issue view` command and analyze, solve the issue.

## Steps

1. ** Check GitHub issue by running `gh issue view` command**
  - Read issue title, description. Understand the background.
  - If there are any other issues linked, read them and udnerstand them too.

2. ** Check current codebase according to the issue**
  - Read codebase and understand why we have to solve the issue.
  - Analyze way to solve the issue by reading files, codes.

3. ** Checkout branch for the fix**
  - Checkout new branch with issue number

4. ** Solve the issue**
  - Modify the code and solve the issue
  - check if it is solved. Run compile check or unit tests if needed.
  - If it was complicated issue, make a comment on the issue/PR for documentation.

5. ** Confirm the issue is solved**
  - Make sure the issue is solved
  - Check the codes and process with integration test

6. ** Commit and push the changes**
  - commit, push and publish branch.
  - Open Pull Request using gh cli.
  - Open the PR with web browser and ask user to review it.