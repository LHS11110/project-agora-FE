import {useEffect,useState} from 'react';
import {api} from '../../api/client.js';
import {useAuth} from '../../state/AuthContext.jsx';
import {useUiLocale} from '../../i18n/useUiLocale.js';
import {activityStats,calendarDays} from './profileActivity.js';
import './profile-progress.css';
export default function ProfileProgress(){
 const {user,token}=useAuth(),en=useUiLocale()==='en',t=(ko,english)=>en?english:ko;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date()),now=new Date(`${today}T12:00:00`),currentYear=now.getFullYear();
 const [year,setYear]=useState(currentYear),[days,setDays]=useState({}),[saved,setSaved]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError('');api('/api/users/me/activity',{token}).then(data=>{if(!active)return;setDays(data.days||{});setSaved(data.lastPersistedAt||null);}).catch(()=>{if(active)setError(t('활동 기록을 불러오지 못했습니다.','Unable to load activity.'));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[user?.user_id,token,refresh]);
 const stats=activityStats(days,now),calendar=calendarDays(year,now),total=Object.entries(days).filter(([day])=>day.startsWith(`${year}-`)).reduce((sum,[,value])=>sum+Number(value.count||0),0);
 const achievements=[
  [t('첫 편집','First edit'),1], [t('아이디어 쌓기','Building ideas'),10], [t('꾸준한 작업','Steady work'),100], [t('캔버스 장인','Canvas craft'),1000]
 ];
 const all=Object.values(days).reduce((n,value)=>n+Number(value.count||0),0);
 return <div className="profile-progress">
  <section className="profile-card progress-card"><div className="progress-heading"><div><span className="section-kicker">MILESTONES</span><h2>{t('나의 도전과제','My achievements')}</h2></div><span>{achievements.filter(([,goal])=>all>=goal).length} / {achievements.length}</span></div><div className="profile-achievements">{achievements.map(([name,goal])=><article key={goal} className={all>=goal?'achievement unlocked':'achievement'}><span className="achievement-symbol" aria-hidden="true">{all>=goal?'✓':'◇'}</span><div><strong>{name}</strong><p>{goal} {t('회 편집','edits')}</p><progress value={Math.min(all,goal)} max={goal}/><small>{Math.min(all,goal)} / {goal}</small></div></article>)}</div></section>
  <section className="profile-card progress-card"><div className="progress-heading"><div><span className="section-kicker">CANVAS ACTIVITY</span><h2>{t('나의 캔버스 활동','My canvas activity')}</h2></div><div className="progress-heading-actions"><select aria-label={t('활동 연도','Activity year')} value={year} onChange={event=>setYear(Number(event.target.value))}>{[0,1,2].map(n=><option key={n}>{currentYear-n}</option>)}</select><button type="button" disabled={loading} onClick={()=>setRefresh(n=>n+1)}>{t('새로고침','Refresh')}</button></div></div>
   <div className="progress-stats"><span><strong>{total}</strong> {t('선택 연도 편집 수','edits in selected year')}</span><span><strong>{stats.streak}</strong> {t('연속 활동일','day streak')}</span><span><strong>{stats.activeDays}</strong> {t('활동일','active days')}</span></div>
   {loading&&<p role="status">{t('활동 기록을 불러오는 중…','Loading activity…')}</p>}{error&&<p role="alert">{error}</p>}
   <div className="profile-grass-scroll" tabIndex={0} aria-label={t('캔버스 활동 달력','Canvas activity calendar')}><div className="grass-months">{Array.from({length:12},(_,month)=><span key={month}>{new Date(year,month,1).toLocaleDateString(en?'en-US':'ko-KR',{month:'short'})}</span>)}</div><div className="profile-grass" style={{'--weeks':Math.ceil((calendar[0].weekday+calendar.length)/7)}}>{calendar.map((day,index)=>{
    const data=days[day.date],count=Number(data?.count||0),level=day.future||!count?0:count<5?1:count<20?2:count<50?3:4;
    const label=`${day.date} · ${t('활동','Activity')} ${count} · ${t('생성','Created')} ${data?.created||0} · ${t('수정','Updated')} ${data?.updated||0} · ${t('삭제','Deleted')} ${data?.deleted||0}`;
    return <span key={day.date} role="img" title={label} aria-label={label} className={`grass-cell level-${level}${day.future?' future':''}`} style={{gridColumn:Math.floor((index+calendar[0].weekday)/7)+1,gridRow:day.weekday+1}}/>;
   })}</div></div><div className="grass-legend"><span>{t('적음','Less')}</span>{[0,1,2,3,4].map(level=><i key={level} className={`grass-cell level-${level}`}/>)}<span>{t('많음','More')}</span></div>
   <p className="progress-note">{t('C++ 서버가 저장에 성공한 객체 생성·수정·삭제를 집계합니다. 방문·마우스 이동·자동 실행 결과는 포함하지 않습니다. 한국 시간 기준이며 새 활동은 최대 30분 간격으로 DB에 반영됩니다.','The C++ server counts committed object creations, updates and deletions. Visits, pointer movement and automatic execution output are excluded. Dates use Korea time; new activity is persisted every 30 minutes.')}</p>
   <p className="progress-note">{saved?`${t('마지막 DB 반영','Last persisted')}: ${new Date(saved).toLocaleString(en?'en-US':'ko-KR')}`:t('아직 DB에 반영된 캔버스 활동이 없습니다.','No persisted canvas activity yet.')}</p>
  </section>
 </div>;
}
