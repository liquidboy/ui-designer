export interface PropertyField {
  key: string;
  label: string;
  value: string | number | boolean;
}

export interface PropertySection {
  id: string;
  title: string;
  fields: PropertyField[];
}

export function createPropertySections(): PropertySection[] {
  return [
    {
      id: 'layout',
      title: 'Layout',
      fields: [
        { key: 'width', label: 'Width', value: 'Auto' },
        { key: 'height', label: 'Height', value: 'Auto' }
      ]
    },
    {
      id: 'appearance',
      title: 'Appearance',
      fields: [
        { key: 'background', label: 'Background', value: '#162027' },
        { key: 'opacity', label: 'Opacity', value: 1 }
      ]
    }
  ];
}
