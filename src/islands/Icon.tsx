import { ICONS, type IconName } from '../lib/icons';

interface Props { name: IconName; size?: number; stroke?: number; class?: string }

export default function Icon({ name, size = 20, stroke = 1.8, class: cls }: Props) {
  return (
    <svg
      class={cls}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={stroke}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}
