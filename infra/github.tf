# GitHub Actions signs in to AWS with OIDC: short-lived credentials, no access keys stored anywhere.

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

locals {
  # Workflows hard-code these ARNs (.github/workflows/), so keep the names stable.
  github_roles = {
    # Release tags (v1, v2, ...): terraform apply + upload the site. Admin, but only inside this
    # account, which holds nothing except nagels.dev. Pushing to main deploys nothing.
    "github-deploy" = {
      subject = "repo:${var.github_repo}:ref:refs/tags/v*"
      policy  = "arn:aws:iam::aws:policy/AdministratorAccess"
    }
    # Pull requests: terraform plan only, read-only.
    "github-plan" = {
      subject = "repo:${var.github_repo}:pull_request"
      policy  = "arn:aws:iam::aws:policy/ReadOnlyAccess"
    }
  }
}

resource "aws_iam_role" "github" {
  for_each = local.github_roles

  name                 = each.key
  max_session_duration = 3600
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = { "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com" }
        StringLike   = { "token.actions.githubusercontent.com:sub" = each.value.subject }
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "github" {
  for_each   = local.github_roles
  role       = aws_iam_role.github[each.key].name
  policy_arn = each.value.policy
}
