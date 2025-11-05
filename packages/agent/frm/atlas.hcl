variable "db_url" {
  type = string
  default = "sqlite://storage/frm.db"
}

env "local" {
  src = "file://migrations"
  url = var.db_url
  dev = "sqlite://file?mode=memory"
}

