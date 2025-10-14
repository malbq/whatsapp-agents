variable "db_url" {
  type = string
  default = "sqlite://storage/assistant.db"
}

env "local" {
  src = "file://src/infra/dbSetup/"
  url = var.db_url
  dev = "sqlite://file?mode=memory"
}

