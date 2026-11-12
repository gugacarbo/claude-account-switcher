//go:build !windows && !darwin

package app

func holdAwake(string) (func(), error) { return func() {}, nil }
