import type { Plan } from "./types";

export interface PlanTier {
  id: Plan;
  name: string;
  priceLabel: string;
  seatsIncluded: number;
  features: string[];
}

export const PLAN_TIERS: PlanTier[] = [
  {
    id: "starter",
    name: "Starter",
    priceLabel: "₹4,999/mo",
    seatsIncluded: 10,
    features: ["10 seats", "Up to 25 agents", "Email support"],
  },
  {
    id: "growth",
    name: "Growth",
    priceLabel: "₹14,999/mo",
    seatsIncluded: 50,
    features: ["50 seats", "Unlimited agents", "SSO & SCIM", "Priority support"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceLabel: "Custom pricing",
    seatsIncluded: 500,
    features: ["Unlimited seats", "Dedicated support", "Custom data residency", "On-prem gateway option"],
  },
];

export const SEATS_BY_PLAN: Record<Plan, number> = {
  trial: 10,
  starter: 10,
  growth: 50,
  enterprise: 500,
};
