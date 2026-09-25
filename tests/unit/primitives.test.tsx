import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Avatar, AvatarGroup } from '@/components/ui/Avatar';
import { Tabs } from '@/components/ui/Tabs';
import { Alert } from '@/components/ui/Alert';
import { Checkbox } from '@/components/ui/Checkbox';
import { Switch } from '@/components/ui/Switch';
import { Tooltip } from '@/components/ui/Tooltip';

describe('Avatar (§65)', () => {
  it('renders deterministic initials fallback', () => {
    render(<Avatar name="Ama Serwaa" />);
    expect(screen.getByLabelText('Ama Serwaa')).toHaveTextContent('AS');
  });

  it('caps initials at two characters', () => {
    render(<Avatar name="Kwame Nkrumah Memorial" />);
    expect(screen.getByRole('img')).toHaveTextContent('KN');
  });

  it('falls back to ? for blank names', () => {
    render(<Avatar name="   " />);
    expect(screen.getByRole('img')).toHaveTextContent('?');
  });

  it('AvatarGroup shows overflow count', () => {
    render(<AvatarGroup names={['A B', 'C D', 'E F', 'G H', 'I J']} max={4} />);
    expect(screen.getByLabelText('1 more')).toHaveTextContent('+1');
  });
});

describe('Tabs (§68)', () => {
  const items = [
    { id: 'overview', label: 'Overview' },
    { id: 'activity', label: 'Activity' },
    { id: 'audit', label: 'Audit' },
  ];

  it('sets aria-selected and roving tabindex', () => {
    render(<Tabs items={items} active="activity" onChange={() => {}} label="Detail sections" />);
    const selected = screen.getByRole('tab', { name: /Activity/ });
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(selected).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: /Overview/ })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tablist')).toHaveAccessibleName('Detail sections');
  });

  it('navigates with arrow keys (roving focus + selection)', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Tabs items={items} active="overview" onChange={onChange} label="sections" />);

    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('activity');
    expect(screen.getByRole('tab', { name: /Activity/ })).toHaveFocus();
  });

  it('wraps from last to first and supports Home/End', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Tabs items={items} active="audit" onChange={onChange} label="sections" />);

    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('overview');

    await user.keyboard('{End}');
    expect(onChange).toHaveBeenLastCalledWith('audit');

    await user.keyboard('{Home}');
    expect(onChange).toHaveBeenLastCalledWith('overview');
  });
});

describe('Alert (§45)', () => {
  it('renders as alert role for danger, status otherwise', () => {
    const { rerender } = render(<Alert variant="danger" title="Payment reconciliation required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Payment reconciliation required');

    rerender(<Alert variant="info" title="Scheduled maintenance Sunday" />);
    expect(screen.getByRole('status')).toHaveTextContent('Scheduled maintenance Sunday');
  });
});

describe('Checkbox (§26)', () => {
  it('associates label, description and error with the input', async () => {
    const { rerender } = render(
      <Checkbox label="Notify me" description="Weekly summary" />
    );
    const input = screen.getByRole('checkbox', { name: 'Notify me' });
    expect(input).toHaveAccessibleDescription('Weekly summary');

    rerender(<Checkbox label="Notify me" error="Selection is required" />);
    expect(screen.getByRole('checkbox', { name: 'Notify me' })).toHaveAccessibleDescription('Selection is required');
  });

  it('toggles via keyboard', async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Notify me" />);
    const input = screen.getByRole('checkbox', { name: 'Notify me' });
    await user.click(input);
    expect(input).toBeChecked();
  });
});

describe('Switch (§26)', () => {
  it('exposes role=switch with aria-checked and toggles (controlled)', async () => {
    function Controlled() {
      const [checked, setChecked] = useState(false);
      return <Switch label="Compact tables" checked={checked} onCheckedChange={setChecked} />;
    }
    const user = userEvent.setup();
    render(<Controlled />);

    const sw = screen.getByRole('switch', { name: 'Compact tables' });
    expect(sw).toHaveAttribute('aria-checked', 'false');

    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Tooltip (§57)', () => {
  it('associates the label via aria-describedby', () => {
    render(
      <Tooltip label="Collapse navigation">
        <button type="button" aria-label="Collapse navigation">«</button>
      </Tooltip>
    );
    const trigger = screen.getByLabelText('Collapse navigation');
    expect(trigger).toHaveAttribute('aria-describedby');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Collapse navigation');
  });
});
