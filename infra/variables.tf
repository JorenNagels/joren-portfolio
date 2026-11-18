variable "account_id" {
  description = "The nagels-dev AWS account; Terraform refuses to touch any other."
  type        = string
  default     = "030171611942"
}

variable "domain" {
  type    = string
  default = "nagels.dev"
}

variable "github_repo" {
  description = "owner/name of the repo whose GitHub Actions may deploy."
  type        = string
  default     = "JorenNagels/joren-portfolio"
}
