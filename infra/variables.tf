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

variable "verify_txt" {
  description = <<-EOT
    Domain-verification TXT records, as { name = [values] }.

    The name is the domain of the property being verified, not necessarily the site: a Google Search Console
    domain property on nagels.dev is verified at the zone apex and covers every subdomain under it, including
    joren.nagels.dev. Route 53 keeps one TXT record set per name, so every value for a name — a second search
    engine, a renewed token — belongs in the same list rather than in a second record.
  EOT
  type        = map(list(string))
  default = {
    # Google Search Console, domain property nagels.dev (added November 2026).
    "nagels.dev" = ["google-site-verification=QASDNHLe-vPk6xFAPNYfj64-1rvMvW4jY5Z-yPMpo-M"]
  }
}
