import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';

const DOC_PATH = path.resolve(process.cwd(), '..', 'docs', 'project_overview.md');

const rawDoc = fs.readFileSync(DOC_PATH, 'utf-8');
const parsedDoc = matter(rawDoc);
const markdownTree = unified().use(remarkParse).use(remarkGfm).parse(parsedDoc.content);

function getHeadings(tree: any) {
  const headings: string[] = [];
  visit(tree, 'heading', (node) => {
    const text = node.children?.map((child: any) => child.value ?? '').join('').trim();
    headings.push(text);
  });
  return headings;
}

function findSectionNodes(title: string) {
  const nodes: any[] = [];
  const children = markdownTree.children ?? [];
  for (let i = 0; i < children.length; i += 1) {
    const node = children[i];
    if (node.type === 'heading') {
      const headingText = node.children?.map((child: any) => child.value ?? '').join('').trim();
      if (headingText === title) {
        const depth = node.depth ?? 2;
        for (let j = i + 1; j < children.length; j += 1) {
          const sibling = children[j];
          if (sibling.type === 'heading' && (sibling.depth ?? 2) <= depth) {
            break;
          }
          nodes.push(sibling);
        }
        break;
      }
    }
  }
  return nodes;
}

function getOrientationText(): string {
  const marker = '## Orientation Path';
  const start = parsedDoc.content.indexOf(marker);
  if (start === -1) return '';
  const rest = parsedDoc.content.slice(start + marker.length);
  const nextSection = rest.indexOf('\n## ');
  return nextSection === -1 ? rest : rest.slice(0, nextSection);
}

describe('project_overview.md structure', () => {
  it('contains YAML metadata with required keys', () => {
    expect(parsedDoc.data).toMatchObject({
      audience: expect.anything(),
      owners: expect.anything(),
      doc_version: expect.anything(),
      last_reviewed: expect.anything(),
      update_triggers: expect.anything(),
      anchor_slugs: expect.anything(),
    });
  });

  it('parses markdown without errors and exposes headings', () => {
    const headings = getHeadings(markdownTree);
    expect(headings.length).toBeGreaterThan(5);
  });
});

describe('Orientation Path section', () => {
  it('contains exactly three ordered steps with required links', () => {
    const section = getOrientationText();
    expect(section).toContain('README.md');
    expect(section).toContain('docs/AGENT_GUIDE.md');
    expect(section).toContain('docs/TESTING.md');
    const steps = section.match(/^\d+\.\s.+$/gm) ?? [];
    expect(steps.length).toBe(3);
  });

  it('lists canonical commands so onboarding metrics can reference them', () => {
    const section = getOrientationText();
    ['pixi run dev', 'npm run dev', 'npm test', 'npm run test:e2e:ci'].forEach((command) => {
      expect(section).toContain(command);
    });
  });
});

describe('Topic-to-Doc index', () => {
  it('contains the required columns and minimum topics', () => {
    const sectionNodes = findSectionNodes('Topic-to-Doc Index');
    const table = sectionNodes.find((node) => node.type === 'table');
    expect(table, 'table not found in Topic-to-Doc Index section').toBeDefined();
    const headerRow = table.children?.[0];
    const headers =
      headerRow?.children?.map((cell: any) => cell.children?.map((child: any) => child.value ?? '').join('').trim()) ??
      [];
    expect(headers).toEqual(['Topic', 'Use When', 'Primary Doc', 'Secondary / Artifacts']);
    expect(table.children.length - 1).toBeGreaterThanOrEqual(8);
  });
});

describe('Workflow playbooks', () => {
  it('defines required playbooks with descriptive steps', () => {
    const sectionNodes = findSectionNodes('Workflow Playbooks');
    const subheadings = sectionNodes
      .filter((node) => node.type === 'heading')
      .map((node) => node.children?.map((child: any) => child.value ?? '').join('').trim());
    ['New Contributor Playbook', 'Spec Author Playbook', 'Release Triage Playbook'].forEach((title) => {
      expect(subheadings).toContain(title);
    });
  });
});
