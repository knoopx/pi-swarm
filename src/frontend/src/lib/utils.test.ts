import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("utils", () => {
  describe("cn", () => {
    describe("given single class string", () => {
      it("then returns the class string", () => {
        expect(cn("foo")).toBe("foo");
      });
    });

    describe("given multiple class strings", () => {
      it("then merges them", () => {
        expect(cn("foo", "bar")).toBe("foo bar");
      });
    });

    describe("given conditional classes", () => {
      describe("when condition is true", () => {
        it("then includes the class", () => {
          expect(cn("base", true && "included")).toBe("base included");
        });
      });

      describe("when condition is false", () => {
        it("then excludes the class", () => {
          expect(cn("base", false && "excluded")).toBe("base");
        });
      });
    });

    describe("given object syntax", () => {
      it("then includes classes with truthy values", () => {
        expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
      });
    });

    describe("given array of classes", () => {
      it("then flattens and merges", () => {
        expect(cn(["foo", "bar"], "baz")).toBe("foo bar baz");
      });
    });

    describe("given undefined or null values", () => {
      it("then ignores them", () => {
        expect(cn("foo", undefined, null, "bar")).toBe("foo bar");
      });
    });

    describe("given conflicting Tailwind classes", () => {
      it("then last class wins for padding", () => {
        expect(cn("p-4", "p-2")).toBe("p-2");
      });

      it("then last class wins for margin", () => {
        expect(cn("m-2", "m-4")).toBe("m-4");
      });

      it("then last class wins for text color", () => {
        expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
      });

      it("then last class wins for background", () => {
        expect(cn("bg-white", "bg-black")).toBe("bg-black");
      });

      it("then preserves non-conflicting classes", () => {
        expect(cn("p-4 text-red-500", "m-2 text-blue-500")).toBe(
          "p-4 m-2 text-blue-500",
        );
      });
    });

    describe("given mixed input types", () => {
      it("then handles complex combinations", () => {
        const isActive = true;
        const isDisabled = false;
        expect(
          cn(
            "base-class",
            isActive && "active",
            isDisabled && "disabled",
            { highlighted: true, hidden: false },
            ["array-class"],
          ),
        ).toBe("base-class active highlighted array-class");
      });
    });

    describe("given empty inputs", () => {
      it("then returns empty string for no arguments", () => {
        expect(cn()).toBe("");
      });

      it("then returns empty string for empty string", () => {
        expect(cn("")).toBe("");
      });

      it("then returns empty string for all falsy values", () => {
        expect(cn(false, null, undefined, "")).toBe("");
      });
    });

    describe("given Tailwind responsive variants", () => {
      it("then preserves responsive prefixes", () => {
        expect(cn("md:p-4", "lg:p-6")).toBe("md:p-4 lg:p-6");
      });

      it("then merges same responsive variant", () => {
        expect(cn("md:p-4", "md:p-6")).toBe("md:p-6");
      });
    });

    describe("given Tailwind state variants", () => {
      it("then preserves hover states", () => {
        expect(cn("hover:bg-blue-500", "hover:bg-red-500")).toBe(
          "hover:bg-red-500",
        );
      });

      it("then preserves different state variants", () => {
        expect(cn("hover:bg-blue-500", "focus:bg-red-500")).toBe(
          "hover:bg-blue-500 focus:bg-red-500",
        );
      });
    });
  });
});
