.PHONY: frontend check build dev

frontend:
	cd frontend && bun install --frozen-lockfile && bun run build

check:
	go vet -tags headless ./...
	go test -tags headless ./...
	cd frontend && bun install --frozen-lockfile && bun run typecheck && bun run test && bun run build

# purego avoids a C compiler/pkg-config at build time. GTK4/WebKitGTK are
# still required at runtime on Linux. Wails supports this tag on desktop OSes.
build: frontend
	go build -tags "purego production" -trimpath -o dist/claude-account-switcher .

# Run Vite separately with `cd frontend && bun run dev` for hot reload.
dev: frontend
	FRONTEND_DEVSERVER_URL=http://127.0.0.1:5173 go run -tags purego .
