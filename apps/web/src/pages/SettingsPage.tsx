export function SettingsPage() {
  return (
    <section className="page-columns">
      <aside className="panel">
        <p className="eyebrow">Settings</p>
        <h1>设置页</h1>
        <p className="muted">后续可承接用户设置、主题偏好、导出配置与快捷键说明。</p>
      </aside>
      <section className="panel">
        <h2>当前已规划</h2>
        <ul className="bullet-list">
          <li>画布偏好</li>
          <li>主题配置</li>
          <li>账号信息</li>
        </ul>
      </section>
    </section>
  )
}
