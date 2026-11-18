//go:build !windows && !darwin && !linux

package app

func holdAwake(string) (func(), error) { return func() {}, nil }
