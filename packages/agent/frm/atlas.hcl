variable "db_url" {
  type = string
  default = "sqlite://storage/frm.db"
}

env "local" {
  src = [
    "file://../../core/migrations/user.sql",
    "file://../../core/migrations/message.sql",
    "file://../../core/migrations/embedding.sql"
  ]
  url = var.db_url
  dev = "sqlite://file?mode=memory"
}

