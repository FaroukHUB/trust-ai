import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { canAccessPage, canAccessStore, hasPermission } from "./permissions";
import { ROLE_PERMISSIONS } from "./types";
import type { Role, UserProfile } from "./types";

function profileWith(role: Role, stores: string[] = []): UserProfile {
  return {
    id: "p1",
    displayName: "Test",
    role,
    allowedStoreIds: stores,
    active: true,
  };
}

describe("Matrice de permissions (miroir de la fonction SQL app.role_permissions)", () => {
  it("un vendeur ne valide aucune décision importante et n'administre rien", () => {
    expect(hasPermission("vendeur", "valider_decision")).toBe(false);
    expect(hasPermission("vendeur", "administrer")).toBe(false);
    expect(hasPermission("vendeur", "produit_hors_catalogue")).toBe(false);
    expect(hasPermission("vendeur", "creer_commande")).toBe(true);
    expect(hasPermission("vendeur", "encaisser_reglement")).toBe(true);
  });

  it("la logistique n'a pas accès aux encaissements détaillés", () => {
    expect(hasPermission("logistique", "gerer_encaissements")).toBe(false);
    expect(hasPermission("logistique", "gerer_logistique")).toBe(true);
    expect(canAccessPage("logistique", "/encaissements")).toBe(false);
    expect(canAccessPage("logistique", "/arrivages")).toBe(true);
  });

  it("la comptabilité est autorisée sur les règlements", () => {
    expect(hasPermission("comptabilite", "gerer_encaissements")).toBe(true);
    expect(canAccessPage("comptabilite", "/encaissements")).toBe(true);
    expect(canAccessPage("comptabilite", "/achats")).toBe(false);
  });

  it("les achats valident les commandes fournisseurs", () => {
    expect(hasPermission("achats", "gerer_achats")).toBe(true);
    expect(hasPermission("achats", "valider_decision")).toBe(true);
    expect(canAccessPage("achats", "/validations")).toBe(true);
  });

  it("un vendeur est limité à ses magasins autorisés", () => {
    const vendeur = profileWith("vendeur", ["store-her"]);
    expect(canAccessStore(vendeur, "store-her")).toBe(true);
    expect(canAccessStore(vendeur, "store-lis")).toBe(false);
    const direction = profileWith("direction");
    expect(canAccessStore(direction, "store-lis")).toBe(true);
  });

  it("la matrice TS et la matrice SQL restent synchronisées", () => {
    const sql = fs.readFileSync(
      path.join(process.cwd(), "supabase/migrations/20260812000200_rls_policies.sql"),
      "utf8",
    );
    for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      const block = sql.match(
        new RegExp(`when '${role}' then array\\[([\\s\\S]*?)\\]`),
      );
      expect(block, `rôle ${role} absent de la fonction SQL`).not.toBeNull();
      for (const permission of permissions) {
        expect(
          block![1].includes(`'${permission}'`),
          `permission ${permission} du rôle ${role} absente de la matrice SQL`,
        ).toBe(true);
      }
    }
  });
});
