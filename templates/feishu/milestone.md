<!-- template: milestone -->
<!-- required: project_name -->
<!-- optional: milestones[] -->

# {{project_name}} - 项目里程碑

{{#each milestones}}
### {{this.emoji}} {{this.name}} ({{this.date}})
**交付物**：{{this.deliverables}}
**状态**：{{this.status_text}}

{{/each}}
