terraform {
  required_version = ">= 1.10" # use_lockfile (S3-native state locking, no DynamoDB)

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # The state bucket is created once by bootstrap.sh (it can't manage the bucket it lives in).
  backend "s3" {
    bucket       = "nagels-dev-tfstate-030171611942"
    key          = "site/terraform.tfstate"
    region       = "eu-central-1"
    use_lockfile = true
  }
}

# Credentials come from the environment: AWS_PROFILE=nagels-dev locally, OIDC in GitHub Actions.
provider "aws" {
  region              = "eu-central-1"
  allowed_account_ids = [var.account_id]

  default_tags {
    tags = { Project = "nagels.dev", ManagedBy = "terraform" }
  }
}

# CloudFront only accepts certificates from us-east-1.
provider "aws" {
  alias               = "us_east_1"
  region              = "us-east-1"
  allowed_account_ids = [var.account_id]

  default_tags {
    tags = { Project = "nagels.dev", ManagedBy = "terraform" }
  }
}
