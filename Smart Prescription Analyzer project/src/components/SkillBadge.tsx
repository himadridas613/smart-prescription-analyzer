interface SkillBadgeProps {
  skill: string;
  variant?: "technical" | "soft" | "tool" | "missing";
}

const variantStyles: Record<string, string> = {
  technical: "bg-primary/10 text-primary border-primary/20",
  soft: "bg-accent/10 text-accent border-accent/20",
  tool: "bg-success/10 text-success border-success/20",
  missing: "bg-destructive/10 text-destructive border-destructive/20",
};

export function SkillBadge({ skill, variant = "technical" }: SkillBadgeProps) {
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${variantStyles[variant]}`}>
      {skill}
    </span>
  );
}
