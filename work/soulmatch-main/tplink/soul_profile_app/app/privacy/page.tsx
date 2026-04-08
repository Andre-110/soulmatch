import { BackButton } from './BackButton';

export const metadata = {
  title: '数据使用说明 · SoulMatch',
};

type DataRowProps = { icon: string; platform: string; fields: string[] };

function DataRow({ icon, platform, fields }: DataRowProps) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px 16px', marginBottom: '10px', border: '1px solid rgba(255,255,255,0.07)' }}>
      <p style={{ fontWeight: 600, color: '#fff', fontSize: '14px', marginBottom: '8px' }}>{icon} {platform}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {fields.map((f) => (
          <span key={f} style={{
            background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)',
            borderRadius: '20px', padding: '3px 10px', fontSize: '12px',
          }}>{f}</span>
        ))}
      </div>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #2d1b6b 0%, #4a2085 40%, #1a0f3e 100%)',
      padding: '0 0 60px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <BackButton />
      </div>

      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '28px 20px 0' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>数据使用说明</h1>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', marginBottom: '28px', lineHeight: 1.6 }}>
          SoulMatch <strong style={{ color: 'rgba(255,255,255,0.8)' }}>只读取你主动提交的公开主页信息</strong>，用于生成性格报告，不做任何其他用途。
        </p>

        <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.45)', marginBottom: '12px', letterSpacing: '0.5px' }}>各平台读取字段</h2>

        <DataRow icon="🔴" platform="微博" fields={['昵称', '简介', '粉丝数', '关注数', '近期动态摘要']} />
        <DataRow icon="📕" platform="小红书" fields={['昵称', '简介', '笔记数', '获赞收藏数']} />
        <DataRow icon="🎵" platform="抖音" fields={['昵称', '简介', '粉丝数', '关注数', '作品数', '获赞数']} />
        <DataRow icon="🎵" platform="网易云音乐" fields={['昵称', '签名', '听歌数', '等级', '关注数', '粉丝数']} />
        <DataRow icon="📚" platform="豆瓣" fields={['昵称', '简介', '注册时间', '近期收藏影视 / 书籍']} />
        <DataRow icon="💡" platform="知乎" fields={['昵称', '简介', '关注话题', '近期回答摘要']} />

        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px 16px', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p style={{ fontWeight: 600, color: '#fff', fontSize: '14px', marginBottom: '8px' }}>📸 你上传的截图 / 文字</p>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', lineHeight: 1.7, margin: 0 }}>
            仅用于本次报告生成，传给 AI 视觉模型理解，<strong style={{ color: '#fff' }}>不会被人工查看，也不会用于训练模型</strong>。
          </p>
        </div>

        <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.45)', marginBottom: '12px', letterSpacing: '0.5px' }}>我们承诺不做的事</h2>
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px', marginBottom: '32px', border: '1px solid rgba(255,255,255,0.07)' }}>
          {[
            '不存储你的平台密码或 Cookie',
            '不读取私信、好友列表、私密动态等非公开内容',
            '不将你的数据出售或共享给第三方',
            '不用于广告投放或商业化用户画像',
            '原始截图仅短期缓存用于调试，之后自动清理',
          ].map((item) => (
            <div key={item} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'flex-start' }}>
              <span style={{ color: '#a78bfa', flexShrink: 0 }}>✓</span>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>{item}</p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>如有疑问，请联系我们</div>
      </div>
    </div>
  );
}
