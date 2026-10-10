/* ADAM Lab workbook → one tab per widget, read through gviz CSV.
   Sheet: https://docs.google.com/spreadsheets/d/1bmfsOkVl16OJ2KWzWJG6NtV5Ds98fXKnSiRtxKxgzlw
   (공유: 링크가 있는 모든 사용자 = 뷰어). 탭 이름은 아래 키와 정확히 같아야 합니다.
   A tab that does not exist yet (or is empty / has the wrong header) falls
   back to the bundled data/<tab>.json automatically — nothing to change here
   when a tab is added later. Set a value to "" to always use the JSON. */
window.ADAM_SHEET_ID = "1bmfsOkVl16OJ2KWzWJG6NtV5Ds98fXKnSiRtxKxgzlw";

(function () {
  function gviz(tab) {
    return "https://docs.google.com/spreadsheets/d/" + window.ADAM_SHEET_ID +
      "/gviz/tq?tqx=out:csv&headers=1&sheet=" + tab;
  }
  window.ADAM_SHEETS = {
    /* date,title_ko,title_en,tag,link,image,link2   (Home · Latest News)
       tag: Paper | Award | Project | Event | Member   link2: optional second link */
    news: gviz("news"),
    /* type,no,year,authors,title,topics,venue,details,date,presentation,status,link,note,extra_label,extra_link
       type: journal-intl | journal-kr | conf-intl | conf-kr | in-prep   (anything else → "기타", see ?debug=1)
       topics: "am; rl" (ids: cad assembly am kg llm mesh rl edu design dt lca routing safety ship std) */
    publications: gviz("publications"),
    /* no,title,topics,status,number,date,link,note   status: registered | filed   topics: as publications */
    patents: gviz("patents"),
    /* date,category,award,recipients,title,event,organizer,link
       category: paper | presentation | competition */
    awards: gviz("awards"),
    /* name_ko,name_en,role,position,start,end,status,photo,email,link,affiliation,history,lab
       role: professor | postdoc | researcher | phd | ms-phd | ms | undergrad   status: current | alumni */
    members: gviz("members"),
    /* title,org_role,researcher_role,program,funder,start,end,group,status,recruit,hidden,logo,link
       group: PNU | KIT   status: (blank=auto) | ongoing | completed
       recruit: Y = 모집 중 (projects/?recruit=1)   hidden: Y = 숨김
       start/end: 2026.03 · 26.03 · 2026 · 26.XX (연도만 → 진행 막대 없음) */
    projects: gviz("projects"),
    /* date,title,venue,location,link */
    talks: gviz("talks"),
    /* date,caption,image,group,link   group: PNU | KIT   image: assets/gallery/… (권장) */
    gallery: gviz("gallery"),
    /* block,section,type,sub,text,link,image   (Professor·Recruiting·Research·Home text blocks)
       block: which embed (sections/?block=professor) · type: bullet | entry | text | lead | fact | card |
       callout | figure | thumb | profile | contact | button | photo · text: **굵게** {{주황}} [글자](링크) */
    sections: gviz("sections")
  };
})();

