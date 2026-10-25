import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { api } from '../api/client';
import { useAction, type Challenge } from '../api/hooks';
import { C } from '../theme';
import { IcMore } from '../ui/icons';
import { Btn, ErrorText, Field, RoundBtn, Sheet, T } from '../ui/kit';

const REFRESH = [['challenge'], ['artworks'], ['crews'], ['friend'], ['collection'], ['rankings']];

/**
 * 코스(챌린지·작품) 메뉴: 직접 그린 코스 이름 바꾸기, 코스 삭제.
 * 서버가 내려준 canRename·canDelete(만든 사람이나 크루장)일 때만 보인다.
 */
export function CourseMenu({
  c,
  onDeleted,
  extra,
  style,
}: {
  c: Challenge;
  onDeleted: () => void;
  /** 메뉴 맨 위에 더 넣을 항목(예: 크루장의 챌린지 중단) */
  extra?: { title: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}) {
  const [open, setOpen] = useState<null | 'menu' | 'rename' | 'delete'>(null);
  const [name, setName] = useState('');
  const rename = useAction((n: string) => api(`/challenges/${c.id}/category`, { method: 'PATCH', body: { name: n } }), REFRESH);
  const remove = useAction(() => api(`/challenges/${c.id}`, { method: 'DELETE' }), REFRESH);
  if (!c.canRename && !c.canDelete && !extra) return <View style={[{ width: 44 }, style]} />;
  const close = () => {
    setOpen(null);
    rename.reset();
    remove.reset();
  };
  return (
    <>
      <RoundBtn kind="custom" label="코스 메뉴" onPress={() => setOpen('menu')} style={style}>
        <IcMore />
      </RoundBtn>
      <Sheet open={!!open} onClose={close} inset={8} radius={28}>
        {open === 'rename' ? (
          <>
            <T size={20} weight="700">
              코스 이름 바꾸기
            </T>
            <Field value={name} onChangeText={setName} placeholder="예: 우리 동네 고래" maxLength={12} autoFocus />
            <ErrorText error={rename.error} />
            <Btn title="저장" disabled={!name.trim()} loading={rename.isPending} onPress={() => rename.mutate(name.trim(), { onSuccess: close })} />
          </>
        ) : open === 'delete' ? (
          <>
            <T size={20} weight="700">
              {c.status === 'active' ? '이 코스를 지울까요?' : '이 작품을 지울까요?'}
            </T>
            <T size={14} color={C.sub} lh={1.5}>
              {c.status === 'active' ? '진행 중인 챌린지와 지금까지 그린 기록이 함께 지워져요.' : '작품과 함께 그린 기록이 지워져요.'} 크루원 모두에게서 사라지고 되돌릴 수 없어요. 달린 거리
              기록과 크루 XP는 남아요.
            </T>
            <ErrorText error={remove.error} />
            <Btn
              title="삭제"
              kind="danger"
              loading={remove.isPending}
              onPress={() =>
                remove.mutate(undefined, {
                  onSuccess: () => {
                    close();
                    onDeleted();
                  },
                })
              }
            />
            <Btn title="취소" kind="ghost" onPress={close} style={{ backgroundColor: 'transparent' }} />
          </>
        ) : (
          <>
            <T size={20} weight="700">
              {c.name}
            </T>
            {extra ? <Btn title={extra.title} kind="secondary" onPress={() => (close(), extra.onPress())} /> : null}
            {c.canRename ? (
              <Btn
                title="이름 바꾸기"
                kind="secondary"
                onPress={() => {
                  setName(c.category ?? '');
                  setOpen('rename');
                }}
              />
            ) : null}
            {c.canDelete ? <Btn title={c.status === 'active' ? '코스 삭제' : '작품 삭제'} kind="dangerSoft" onPress={() => setOpen('delete')} /> : null}
            <Btn title="취소" kind="ghost" onPress={close} style={{ backgroundColor: 'transparent' }} />
          </>
        )}
      </Sheet>
    </>
  );
}
