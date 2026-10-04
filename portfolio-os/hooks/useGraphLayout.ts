import { useMemo } from 'react';
import type { GraphSkillNode } from '@/components/skills/SkillSectionGraph';

export interface LayoutConfig {
  leftX?: number;
  leftWidth?: number;
  rightWidth?: number;
  totalWidth?: number;
  rowHeight?: number;
  verticalPadding?: number;
}

export function useGraphLayout(
  connectedSkills: GraphSkillNode[],
  uniqueTargets: any[],
  config: LayoutConfig = {}
) {
  const {
    leftX = 14,
    leftWidth = 180,
    rightWidth = 200,
    totalWidth = 720,
    rowHeight = 32,
    verticalPadding = 20,
  } = config;

  return useMemo(() => {
    const leftCount = connectedSkills.length;
    const rightCount = uniqueTargets.length;
    const maxItems = Math.max(leftCount, rightCount);
    const canvasHeight = Math.max(160, maxItems * rowHeight + verticalPadding * 2);
    const rightX = totalWidth - rightWidth - 14;

    const leftStep = (canvasHeight - verticalPadding * 2) / Math.max(1, leftCount);
    const skillNodes = connectedSkills.map((skill, idx) => {
      const cy = verticalPadding + idx * leftStep + leftStep / 2;
      return {
        data: skill,
        x: leftX,
        y: cy - 12,
        cy,
        width: leftWidth,
        height: 24,
      };
    });

    const rightStep = (canvasHeight - verticalPadding * 2) / Math.max(1, rightCount);
    const targetNodes = uniqueTargets.map((target, idx) => {
      const cy = verticalPadding + idx * rightStep + rightStep / 2;
      return {
        data: target,
        x: rightX,
        y: cy - 12,
        cy,
        width: rightWidth,
        height: 24,
      };
    });

    const skillMap = new Map(skillNodes.map(n => [n.data.id, n]));
    const targetMap = new Map(targetNodes.map(n => [n.data.id, n]));

    const edges = connectedSkills.flatMap(skill => {
      const sNode = skillMap.get(skill.id);
      if (!sNode) return [];
      const x1 = leftX + leftWidth;
      const y1 = sNode.cy;

      return skill.targets.map(target => {
        const tNode = targetMap.get(target.id);
        if (!tNode) return null;
        
        const x2 = rightX;
        const y2 = tNode.cy;
        const dx = (x2 - x1) * 0.5;
        const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

        return {
          id: `${skill.id}->${target.id}`,
          skillId: skill.id,
          targetId: target.id,
          d,
        };
      }).filter((e): e is NonNullable<typeof e> => e !== null);
    });

    return {
      nodes: {
        skills: skillNodes,
        targets: targetNodes,
      },
      edges,
      dimensions: {
        width: totalWidth,
        height: canvasHeight,
      },
    };
  }, [connectedSkills, uniqueTargets, leftX, leftWidth, rightWidth, totalWidth, rowHeight, verticalPadding]);
}
