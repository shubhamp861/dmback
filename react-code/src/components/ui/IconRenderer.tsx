import React from 'react';
import * as Icons from 'lucide-react';

export interface IconRendererProps {
  name: string;
  className?: string;
  size?: number;
}

export const IconRenderer: React.FC<IconRendererProps> = ({ name, className = 'w-4 h-4', size }) => {
  // Safe lookup in lucide icons map
  const IconComponent = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; size?: number }>>)[name] || Icons.Link2;

  return <IconComponent className={className} size={size} />;
};

export const AVAILABLE_ICONS = [
  { name: 'Sparkles', label: 'Sparkles' },
  { name: 'Camera', label: 'Camera' },
  { name: 'Calendar', label: 'Calendar' },
  { name: 'Send', label: 'Send / DM' },
  { name: 'ShoppingBag', label: 'Store' },
  { name: 'BookOpen', label: 'Course' },
  { name: 'Zap', label: 'Flash' },
  { name: 'Video', label: 'Reel / Video' },
  { name: 'FileText', label: 'Guide / PDF' },
  { name: 'ExternalLink', label: 'Link' },
];
