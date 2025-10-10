env "local" {
  src = "file://src/infra/dbSetup/"
  url = "sqlite://storage/assistant.db"
  dev = "sqlite://file?mode=memory"
}

