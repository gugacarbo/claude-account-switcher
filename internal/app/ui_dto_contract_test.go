package app

import (
	"fmt"
	"os"
	"reflect"
	"sort"
	"strings"
	"testing"
	"time"
)

// The checked-in TypeScript contract is derived from the actual JSON DTOs,
// including pointers, nested structs, arrays, omitempty, and time.Time.
func TestUIDTOContract(t *testing.T) {
	names := map[reflect.Type]string{reflect.TypeFor[UIState](): "UIState", reflect.TypeFor[UIAccount](): "Account", reflect.TypeFor[Usage](): "Usage", reflect.TypeFor[UIPrompt](): "Prompt"}
	var tsType func(reflect.Type) string
	tsType = func(typ reflect.Type) string {
		if typ == reflect.TypeFor[time.Time]() {
			return "string"
		}
		if name, ok := names[typ]; ok {
			return name
		}
		switch typ.Kind() {
		case reflect.Pointer:
			return tsType(typ.Elem()) + " | null"
		case reflect.Slice:
			return "(" + tsType(typ.Elem()) + ")[]"
		case reflect.String:
			return "string"
		case reflect.Bool:
			return "boolean"
		case reflect.Float64, reflect.Uint64:
			return "number"
		case reflect.Struct:
			fields := []string{}
			for i := 0; i < typ.NumField(); i++ {
				f := typ.Field(i)
				fields = append(fields, strings.Split(f.Tag.Get("json"), ",")[0]+": "+tsType(f.Type)+";")
			}
			return "{ " + strings.Join(fields, " ") + " }"
		default:
			t.Fatalf("unsupported contract type: %s", typ)
			return ""
		}
	}
	types := []reflect.Type{reflect.TypeFor[Usage](), reflect.TypeFor[UIAccount](), reflect.TypeFor[UIPrompt](), reflect.TypeFor[UIState]()}
	var out strings.Builder
	out.WriteString("// Generated from Go JSON DTOs. Run bun run generate:contract; do not edit.\n")
	for _, typ := range types {
		fmt.Fprintf(&out, "export interface %s {\n", names[typ])
		fields := []string{}
		for i := 0; i < typ.NumField(); i++ {
			f := typ.Field(i)
			tag := strings.Split(f.Tag.Get("json"), ",")
			optional := ""
			if len(tag) > 1 && tag[1] == "omitempty" {
				optional = "?"
			}
			fields = append(fields, fmt.Sprintf("  %s%s: %s;\n", tag[0], optional, tsType(f.Type)))
		}
		sort.Strings(fields)
		for _, field := range fields {
			out.WriteString(field)
		}
		out.WriteString("}\n")
	}
	path := "../../frontend/src/contracts.generated.ts"
	if os.Getenv("UPDATE_UI_CONTRACT") == "1" {
		if err := os.WriteFile(path, []byte(out.String()), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	actual, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(actual) != out.String() {
		t.Fatal("Go/TypeScript DTO drift: run bun run generate:contract and review the diff")
	}
}
