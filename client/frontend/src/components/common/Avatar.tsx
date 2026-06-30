interface AvatarProps {
  letter: string;
  color: string;
  size?: number;
}

export function Avatar({ letter, color, size = 28 }: AvatarProps) {
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.45,
        fontWeight: 600,
        color: '#fff',
        flexShrink: 0,
      }}
    >
      {letter}
    </div>
  );
}
