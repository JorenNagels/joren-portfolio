#!/usr/bin/env bash
# One-time setup, run from your own machine: creates the S3 bucket that holds Terraform's state.
# Everything else (including the role GitHub Actions uses) is in Terraform; after the first local
# `terraform apply`, GitHub Actions takes over.
#
#   aws sso login --sso-session jjco
#   AWS_PROFILE=nagels-dev infra/bootstrap.sh
set -euo pipefail

BUCKET=nagels-dev-tfstate-030171611942
REGION=eu-central-1

[ "$(aws sts get-caller-identity --query Account --output text)" = 030171611942 ] \
  || { echo "Not signed in to the nagels-dev account (030171611942). Set AWS_PROFILE=nagels-dev." >&2; exit 1; }

if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "State bucket $BUCKET already exists."
else
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
  echo "Created $BUCKET."
fi

aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
# Versioning: a broken state can be rolled back. Old versions expire after 90 days to stay ~free.
aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --lifecycle-configuration '{
  "Rules": [{ "ID": "expire-old-state", "Status": "Enabled", "Filter": {},
              "NoncurrentVersionExpiration": { "NoncurrentDays": 90 } }]
}'
echo "Done. Next: cd infra && terraform init && terraform apply"
