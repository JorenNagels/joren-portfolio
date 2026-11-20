variable "account_id" {
  description = "The nagels-dev AWS account; Terraform refuses to touch any other."
  type        = string
  default     = "030171611942"
}

variable "zone" {
  description = "The Route 53 hosted zone, from the domain registration. The site lives on a subdomain of it."
  type        = string
  default     = "nagels.dev"
}

variable "domain" {
  description = "The site's canonical hostname. The zone apex and www redirect to it."
  type        = string
  default     = "joren.nagels.dev"
}

variable "github_sub" {
  description = <<-EOT
    Who GitHub says it is when it signs in. The owner's and the repo's numeric ids are in there as well as their
    names, so that renaming either cannot hand these roles to whoever picks up the old name; GitHub has sent it
    this way for repos made since July 2026. Read the exact prefix back with:
      gh api repos/<owner>/<name>/actions/oidc/customization/sub
  EOT
  type        = string
  default     = "repo:JorenNagels@37642555/joren-portfolio@1456589136"
}
