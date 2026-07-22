// 界面文案表。四种语言的键必须完全一致 —— i18n.test.ts 会断言,漏译即失败。
//
// 注意:这里只管**界面**语言。商品名的翻译语言跟着账单走(识别时定下),
// 切界面语言不会重译已识别的商品名 —— 那需要重新识别整张发票。

export const LANGS = ['zh', 'en', 'nl', 'de'] as const;
export type Lang = (typeof LANGS)[number];

/** 语言自称,给切换器用(各语言用自己的写法,不随界面语言变) */
export const LANG_NAMES: Record<Lang, string> = {
  zh: '中文',
  en: 'English',
  nl: 'Nederlands',
  de: 'Deutsch',
};

const zh = {
  'common.save': '保存',
  'common.cancel': '取消',
  'common.edit': '编辑',
  'common.delete': '删除',
  'common.add': '添加',
  'common.confirm': '确认',
  'common.loading': '加载中…',
  'common.copied': '已复制 ✓',

  'nav.billList': 'AAbill 账单',
  'nav.billDetail': '账单详情',

  'login.title': '登录 AAbill',
  'login.google': '用 Google 账号登录',
  'login.googleScriptFailed': '无法加载 Google 登录脚本',
  'login.googleUnavailable': 'Google 登录不可用',
  'login.devHint': '开发登录:输入邮箱即可',
  'login.submit': '登录',
  'login.failed': '登录失败 {status}',

  'bills.mine': '我的账单',
  'bills.logout': '退出登录',
  'bills.titlePlaceholder': '账单标题(如 Metro 05-16)',
  'bills.create': '新建',
  'bills.empty': '还没有账单,拍一张发票开始吧。',
  'bills.taxPending': '税制待定',

  'bill.upload': '上传发票识别(图片或 PDF)',
  'bill.reupload': '重新识别发票(覆盖 AI 条目)',
  'bill.viewInvoice': '查看原始发票 ↗',
  'bill.printedTotals': '发票印刷合计(€)',
  'bill.net': '净额',
  'bill.vatA': 'A 税额',
  'bill.vatB': 'B 税额',
  'bill.gross': '含税',
  'bill.saveAndValidate': '保存合计并校验',
  'bill.items': '条目({n})',
  'bill.addRow': '＋ 手动加行',
  'bill.newItem': '新条目',
  'bill.families': '参与家庭',
  'bill.noFamilies':
    '⚠️ 还没添加家庭 —— 朋友打开分享链接将无法认领,请先把参与的家庭加上。',
  'bill.share': '分享认领',
  'bill.copyLink': '复制分享链接',
  'bill.claimProgress': '认领进度:{done}/{total}',
  'bill.lockedSuffix': ' · 已锁定',
  'bill.summary': 'AA 汇总',
  'bill.copySummary': '复制汇总文本',
  'bill.lock': '锁定账单(认领与条目不可再改)',
  'bill.lockHint': '全部商品认领完成后,这里会出现 AA 汇总与锁定按钮。',
  'bill.parsing': '识别中(多页发票可能要 1 分钟)…',
  'bill.parseTimeout': '识别超时,请稍后刷新看看,或重试',
  'bill.savingTotals': '保存合计…',
  'bill.badAmount': '合计金额格式不对(最多两位小数)',
  'bill.adding': '加行…',
  'bill.saving': '保存…',
  'bill.deleting': '删除…',
  'bill.addingFamily': '添加家庭…',
  'bill.removingFamily': '删除家庭…',
  'bill.savingTax': '保存税制…',
  'bill.locking': '锁定中…',

  'validate.ok': '✓ 与发票合计一致',
  'validate.near': '✓ 基本吻合(尾差 {amount} €,四舍五入所致)',
  'validate.mismatch': '合计对不上,请核对条目:',
  'validate.netDiff': '净额差',
  'validate.vatADiff': 'A 税额差',
  'validate.vatBDiff': 'B 税额差',
  'validate.grossDiff': '含税差',

  'family.placeholder': '家庭名(如 Rio家)',

  'item.name': '名称',
  'item.nameTranslated': '译名',
  'item.qty': '数量',
  'item.unitPrice': '净单价 €',
  'item.taxClass': '税类 {cls}',
  'item.shared': '均摊',

  'claim.lockedNotice': '账单已锁定,认领结果不可再修改',
  'claim.whichFamily': '我是哪家?',
  'claim.noFamilies': '账单发起人还没添加参与的家庭,暂时无法认领。',
  'claim.noFamiliesHint':
    '请让发起人在账单页的「参与家庭」里把大家加上,然后刷新本页。',
  'claim.pickFamilyFirst': '先选择你的家庭,再勾选自己买的商品。',
  'claim.photo': '📷 拍照认领(AI 帮你预选)',
  'claim.photoBusy': 'AI 识别中…',
  'claim.photoHint':
    '对着你买的东西拍一张,AI 会猜哪些是你的 —— 结果需要你确认。',
  'claim.photoFailed': '拍照识别失败:{error}',
  'claim.items': '商品({n})',
  'claim.chosen': '已选 {kinds} 种 / 共 {units} 件',
  'claim.estimated': '预计应付 {amount} €',
  'claim.exclTax': '(未含税)',
  'claim.netPlusTax': '净额 {amount} € + 税;最终以发起人锁定后的汇总为准。',
  'claim.noTaxYet': '发起人尚未确定税制,暂只显示净额;最终以锁定后的汇总为准。',
  'claim.submit': '提交我的认领',
  'claim.submitting': '提交中…',
  'claim.submitted': '✓ 已提交,大家都能看到了',
  'claim.autoSync': '每 5 秒自动同步别家的认领状态。',
  'claim.conflict':
    '你要领 {requested} 件,但别家已领 {claimedByOthers} 件,只剩 {available} 件',
  'claim.conflictHint': '有商品被别人先领走了,请调整下面高亮的条目后重新提交',
  'claim.sharedItem': '均摊(全家庭平分,无需认领)',
  'claim.perPiece': '{price} €/件 · 共 {total} 件',
  'claim.othersClaimed': '别家已领 {others} 件 · 还剩 {remaining} 件',
  'claim.iTake': '我领 ',
  'claim.pieces': ' 件',
  'claim.typeDirectly': '直接填:',
  'claim.ofPieces': '/ {n} 件',
  'claim.invalidQty': '请输入 0 或正整数',
  'claim.maxQty': '最多可领 {n} 件',

  'suggest.warning':
    '⚠️ 以下是 AI 看照片猜的,可能有误或有遗漏 —— 请你逐项确认后再认领。',
  'suggest.none':
    'AI 没认出账单里的任何商品。可以换个角度重拍,或直接在下面手动勾选。',
  'suggest.confirm': '确认认领({n})',
  'suggest.perPiece': '{n} 件 · {price} €/件',

  'settlement.total': '合计',
  'settlement.breakdown': '净 {net} + 税 {vat}',
  'settlement.summaryTitle': '{title} · AA 汇总',
  'settlement.summaryLine': '{name}:{gross} €(净 {net} + 税 {vat})',
  'settlement.summaryTotal': '合计:{gross} €',

  'tax.settled': '税制 {country} {code}',
  'tax.settledWithRates': '税制 {country} {code} · {a} / {b}',
  'tax.pending': '税制待定 —— 点此选择国家',
  'tax.pickCountry': '选择账单所属国家',
  'tax.pickHint':
    '税率以发票印刷值为准;这里选的国家只在发票读不出税率时用作兜底。',
  'tax.searchPlaceholder': '搜索国家或代码',
  'tax.noMatch': '没有匹配的国家',
  'tax.multiReduced': '{country}有多档低税率',
  'tax.multiReducedHint':
    '食品适用哪一档因商品而异,自动挑一档会算错钱。请对照发票选择:',

  'translation.mismatch': '本账单的商品译名是{lang},与当前界面语言不同。',
  'translation.rescan': '重新识别发票以翻译成{lang}(会覆盖 AI 条目)',

  'lang.label': '语言',
} as const;

export type MessageKey = keyof typeof zh;
type Catalog = Record<MessageKey, string>;

const en: Catalog = {
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.edit': 'Edit',
  'common.delete': 'Delete',
  'common.add': 'Add',
  'common.confirm': 'Confirm',
  'common.loading': 'Loading…',
  'common.copied': 'Copied ✓',

  'nav.billList': 'AAbill',
  'nav.billDetail': 'Bill details',

  'login.title': 'Sign in to AAbill',
  'login.google': 'Sign in with Google',
  'login.googleScriptFailed': 'Could not load the Google sign-in script',
  'login.googleUnavailable': 'Google sign-in is unavailable',
  'login.devHint': 'Dev sign-in: just enter an email',
  'login.submit': 'Sign in',
  'login.failed': 'Sign-in failed ({status})',

  'bills.mine': 'My bills',
  'bills.logout': 'Sign out',
  'bills.titlePlaceholder': 'Bill title (e.g. Metro 05-16)',
  'bills.create': 'New',
  'bills.empty': 'No bills yet — snap a receipt to get started.',
  'bills.taxPending': 'VAT regime pending',

  'bill.upload': 'Upload receipt (image or PDF)',
  'bill.reupload': 'Re-scan receipt (replaces AI rows)',
  'bill.viewInvoice': 'View original receipt ↗',
  'bill.printedTotals': 'Printed totals (€)',
  'bill.net': 'Net',
  'bill.vatA': 'VAT A',
  'bill.vatB': 'VAT B',
  'bill.gross': 'Gross',
  'bill.saveAndValidate': 'Save totals and check',
  'bill.items': 'Items ({n})',
  'bill.addRow': '＋ Add row manually',
  'bill.newItem': 'New item',
  'bill.families': 'Households',
  'bill.noFamilies':
    '⚠️ No households yet — friends opening the share link cannot claim anything. Add them first.',
  'bill.share': 'Share for claiming',
  'bill.copyLink': 'Copy share link',
  'bill.claimProgress': 'Claimed: {done}/{total}',
  'bill.lockedSuffix': ' · locked',
  'bill.summary': 'Split summary',
  'bill.copySummary': 'Copy summary text',
  'bill.lock': 'Lock bill (claims and items become final)',
  'bill.lockHint':
    'Once every item is claimed, the summary and lock button appear here.',
  'bill.parsing': 'Scanning (a multi-page receipt may take a minute)…',
  'bill.parseTimeout': 'Scan timed out — refresh in a moment, or try again',
  'bill.savingTotals': 'Saving totals…',
  'bill.badAmount': 'Invalid amount (at most two decimals)',
  'bill.adding': 'Adding row…',
  'bill.saving': 'Saving…',
  'bill.deleting': 'Deleting…',
  'bill.addingFamily': 'Adding household…',
  'bill.removingFamily': 'Removing household…',
  'bill.savingTax': 'Saving VAT regime…',
  'bill.locking': 'Locking…',

  'validate.ok': '✓ Matches the printed totals',
  'validate.near': '✓ Close enough ({amount} € off, rounding)',
  'validate.mismatch': 'Totals do not match — please check the items:',
  'validate.netDiff': 'Net diff',
  'validate.vatADiff': 'VAT A diff',
  'validate.vatBDiff': 'VAT B diff',
  'validate.grossDiff': 'Gross diff',

  'family.placeholder': 'Household name (e.g. the Rios)',

  'item.name': 'Name',
  'item.nameTranslated': 'Translated name',
  'item.qty': 'Qty',
  'item.unitPrice': 'Net unit price €',
  'item.taxClass': 'VAT class {cls}',
  'item.shared': 'Split evenly',

  'claim.lockedNotice': 'This bill is locked — claims can no longer be changed',
  'claim.whichFamily': 'Which household are you?',
  'claim.noFamilies':
    'The bill owner has not added any households yet, so nothing can be claimed.',
  'claim.noFamiliesHint':
    'Ask them to add everyone under “Households” on the bill page, then refresh this page.',
  'claim.pickFamilyFirst':
    'Pick your household first, then tick the items you bought.',
  'claim.photo': '📷 Claim by photo (AI pre-selects)',
  'claim.photoBusy': 'AI is looking…',
  'claim.photoHint':
    'Photograph what you bought and AI will guess which items are yours — you confirm the result.',
  'claim.photoFailed': 'Photo scan failed: {error}',
  'claim.items': 'Items ({n})',
  'claim.chosen': '{kinds} kinds selected / {units} pcs total',
  'claim.estimated': 'Estimated total {amount} €',
  'claim.exclTax': ' (excl. VAT)',
  'claim.netPlusTax':
    'Net {amount} € plus VAT; the owner’s locked summary is final.',
  'claim.noTaxYet':
    'The owner has not set the VAT regime yet, so only the net amount is shown; the locked summary is final.',
  'claim.submit': 'Submit my claims',
  'claim.submitting': 'Submitting…',
  'claim.submitted': '✓ Submitted — everyone can see it now',
  'claim.autoSync': 'Other households’ claims sync every 5 seconds.',
  'claim.conflict':
    'You asked for {requested}, but others already claimed {claimedByOthers} — only {available} left',
  'claim.conflictHint':
    'Someone claimed those first. Adjust the highlighted items and submit again.',
  'claim.sharedItem': 'Split evenly across all households — no claim needed',
  'claim.perPiece': '{price} €/pc · {total} pcs total',
  'claim.othersClaimed': 'Others claimed {others} · {remaining} left',
  'claim.iTake': 'I take ',
  'claim.pieces': ' pcs',
  'claim.typeDirectly': 'Type it:',
  'claim.ofPieces': '/ {n} pcs',
  'claim.invalidQty': 'Enter 0 or a positive whole number',
  'claim.maxQty': 'At most {n} available',

  'suggest.warning':
    '⚠️ These are AI guesses from your photo and may be wrong or incomplete — please check each one before claiming.',
  'suggest.none':
    'AI did not recognise any item from this bill. Try another angle, or tick them manually below.',
  'suggest.confirm': 'Claim selected ({n})',
  'suggest.perPiece': '{n} pcs · {price} €/pc',

  'settlement.total': 'Total',
  'settlement.breakdown': 'net {net} + VAT {vat}',
  'settlement.summaryTitle': '{title} · split summary',
  'settlement.summaryLine': '{name}: {gross} € (net {net} + VAT {vat})',
  'settlement.summaryTotal': 'Total: {gross} €',

  'tax.settled': 'VAT {country} {code}',
  'tax.settledWithRates': 'VAT {country} {code} · {a} / {b}',
  'tax.pending': 'VAT regime pending — tap to pick a country',
  'tax.pickCountry': 'Pick the country this bill belongs to',
  'tax.pickHint':
    'Rates printed on the receipt take precedence; this country is only a fallback when they cannot be read.',
  'tax.searchPlaceholder': 'Search country or code',
  'tax.noMatch': 'No matching country',
  'tax.multiReduced': '{country} has several reduced rates',
  'tax.multiReducedHint':
    'Which one applies depends on the goods, and guessing would get the money wrong. Pick the one on your receipt:',

  'translation.mismatch':
    'Item names on this bill are translated into {lang}, which differs from your interface language.',
  'translation.rescan':
    'Re-scan the receipt to translate into {lang} (replaces AI rows)',

  'lang.label': 'Language',
};

const nl: Catalog = {
  'common.save': 'Opslaan',
  'common.cancel': 'Annuleren',
  'common.edit': 'Bewerken',
  'common.delete': 'Verwijderen',
  'common.add': 'Toevoegen',
  'common.confirm': 'Bevestigen',
  'common.loading': 'Laden…',
  'common.copied': 'Gekopieerd ✓',

  'nav.billList': 'AAbill',
  'nav.billDetail': 'Bondetails',

  'login.title': 'Inloggen bij AAbill',
  'login.google': 'Inloggen met Google',
  'login.googleScriptFailed': 'Kon het Google-inlogscript niet laden',
  'login.googleUnavailable': 'Google-inloggen is niet beschikbaar',
  'login.devHint': 'Dev-login: voer een e-mailadres in',
  'login.submit': 'Inloggen',
  'login.failed': 'Inloggen mislukt ({status})',

  'bills.mine': 'Mijn bonnen',
  'bills.logout': 'Uitloggen',
  'bills.titlePlaceholder': 'Titel van de bon (bijv. Metro 05-16)',
  'bills.create': 'Nieuw',
  'bills.empty': 'Nog geen bonnen — maak een foto van een bon om te beginnen.',
  'bills.taxPending': 'Btw-regime onbekend',

  'bill.upload': 'Bon uploaden (afbeelding of PDF)',
  'bill.reupload': 'Bon opnieuw scannen (vervangt AI-regels)',
  'bill.viewInvoice': 'Originele bon bekijken ↗',
  'bill.printedTotals': 'Gedrukte totalen (€)',
  'bill.net': 'Netto',
  'bill.vatA': 'Btw A',
  'bill.vatB': 'Btw B',
  'bill.gross': 'Bruto',
  'bill.saveAndValidate': 'Totalen opslaan en controleren',
  'bill.items': 'Artikelen ({n})',
  'bill.addRow': '＋ Regel handmatig toevoegen',
  'bill.newItem': 'Nieuw artikel',
  'bill.families': 'Huishoudens',
  'bill.noFamilies':
    '⚠️ Nog geen huishoudens — wie de deellink opent kan niets claimen. Voeg ze eerst toe.',
  'bill.share': 'Delen om te claimen',
  'bill.copyLink': 'Deellink kopiëren',
  'bill.claimProgress': 'Geclaimd: {done}/{total}',
  'bill.lockedSuffix': ' · vergrendeld',
  'bill.summary': 'Verdeeloverzicht',
  'bill.copySummary': 'Overzicht kopiëren',
  'bill.lock': 'Bon vergrendelen (claims en regels definitief)',
  'bill.lockHint':
    'Zodra alles geclaimd is, verschijnen hier het overzicht en de vergrendelknop.',
  'bill.parsing':
    'Scannen (een bon van meerdere pagina’s duurt tot een minuut)…',
  'bill.parseTimeout':
    'Scan duurde te lang — ververs zo meteen, of probeer opnieuw',
  'bill.savingTotals': 'Totalen opslaan…',
  'bill.badAmount': 'Ongeldig bedrag (hoogstens twee decimalen)',
  'bill.adding': 'Regel toevoegen…',
  'bill.saving': 'Opslaan…',
  'bill.deleting': 'Verwijderen…',
  'bill.addingFamily': 'Huishouden toevoegen…',
  'bill.removingFamily': 'Huishouden verwijderen…',
  'bill.savingTax': 'Btw-regime opslaan…',
  'bill.locking': 'Vergrendelen…',

  'validate.ok': '✓ Komt overeen met de gedrukte totalen',
  'validate.near': '✓ Vrijwel gelijk ({amount} € verschil door afronding)',
  'validate.mismatch': 'Totalen kloppen niet — controleer de regels:',
  'validate.netDiff': 'Verschil netto',
  'validate.vatADiff': 'Verschil btw A',
  'validate.vatBDiff': 'Verschil btw B',
  'validate.grossDiff': 'Verschil bruto',

  'family.placeholder': 'Naam huishouden (bijv. familie Rio)',

  'item.name': 'Naam',
  'item.nameTranslated': 'Vertaalde naam',
  'item.qty': 'Aantal',
  'item.unitPrice': 'Netto stukprijs €',
  'item.taxClass': 'Btw-klasse {cls}',
  'item.shared': 'Gelijk verdelen',

  'claim.lockedNotice':
    'Deze bon is vergrendeld — claims kunnen niet meer worden gewijzigd',
  'claim.whichFamily': 'Welk huishouden ben jij?',
  'claim.noFamilies':
    'De eigenaar heeft nog geen huishoudens toegevoegd, dus er valt niets te claimen.',
  'claim.noFamiliesHint':
    'Vraag of ze iedereen toevoegen onder “Huishoudens” op de bonpagina en ververs deze pagina.',
  'claim.pickFamilyFirst':
    'Kies eerst je huishouden en vink daarna aan wat jij gekocht hebt.',
  'claim.photo': '📷 Claimen met foto (AI selecteert alvast)',
  'claim.photoBusy': 'AI kijkt mee…',
  'claim.photoHint':
    'Fotografeer wat je gekocht hebt; AI raadt welke artikelen van jou zijn — jij bevestigt.',
  'claim.photoFailed': 'Fotoscan mislukt: {error}',
  'claim.items': 'Artikelen ({n})',
  'claim.chosen': '{kinds} soorten gekozen / {units} stuks totaal',
  'claim.estimated': 'Geschat te betalen {amount} €',
  'claim.exclTax': ' (excl. btw)',
  'claim.netPlusTax':
    'Netto {amount} € plus btw; het vergrendelde overzicht is bepalend.',
  'claim.noTaxYet':
    'De eigenaar heeft het btw-regime nog niet vastgesteld, dus alleen het nettobedrag wordt getoond; het vergrendelde overzicht is bepalend.',
  'claim.submit': 'Mijn claims indienen',
  'claim.submitting': 'Indienen…',
  'claim.submitted': '✓ Ingediend — iedereen kan het nu zien',
  'claim.autoSync':
    'Claims van andere huishoudens worden elke 5 seconden bijgewerkt.',
  'claim.conflict':
    'Je wilde er {requested}, maar anderen claimden al {claimedByOthers} — nog {available} over',
  'claim.conflictHint':
    'Iemand was je voor. Pas de gemarkeerde regels aan en dien opnieuw in.',
  'claim.sharedItem':
    'Gelijk verdeeld over alle huishoudens — claimen niet nodig',
  'claim.perPiece': '{price} €/st · {total} st totaal',
  'claim.othersClaimed': 'Anderen claimden {others} · nog {remaining} over',
  'claim.iTake': 'Ik neem ',
  'claim.pieces': ' st',
  'claim.typeDirectly': 'Zelf invullen:',
  'claim.ofPieces': '/ {n} st',
  'claim.invalidQty': 'Voer 0 of een positief geheel getal in',
  'claim.maxQty': 'Hoogstens {n} beschikbaar',

  'suggest.warning':
    '⚠️ Dit zijn gokjes van de AI op basis van je foto en kunnen fout of onvolledig zijn — controleer ze stuk voor stuk.',
  'suggest.none':
    'De AI herkende geen enkel artikel van deze bon. Probeer een andere hoek, of vink ze hieronder handmatig aan.',
  'suggest.confirm': 'Selectie claimen ({n})',
  'suggest.perPiece': '{n} st · {price} €/st',

  'settlement.total': 'Totaal',
  'settlement.breakdown': 'netto {net} + btw {vat}',
  'settlement.summaryTitle': '{title} · verdeeloverzicht',
  'settlement.summaryLine': '{name}: {gross} € (netto {net} + btw {vat})',
  'settlement.summaryTotal': 'Totaal: {gross} €',

  'tax.settled': 'Btw {country} {code}',
  'tax.settledWithRates': 'Btw {country} {code} · {a} / {b}',
  'tax.pending': 'Btw-regime onbekend — tik om een land te kiezen',
  'tax.pickCountry': 'Kies het land van deze bon',
  'tax.pickHint':
    'De tarieven op de bon gaan voor; dit land geldt alleen als terugval wanneer ze niet leesbaar zijn.',
  'tax.searchPlaceholder': 'Zoek land of code',
  'tax.noMatch': 'Geen passend land',
  'tax.multiReduced': '{country} heeft meerdere verlaagde tarieven',
  'tax.multiReducedHint':
    'Welk tarief geldt hangt af van het product, en gokken levert een verkeerd bedrag op. Kies wat op je bon staat:',

  'translation.mismatch':
    'De artikelnamen op deze bon zijn vertaald naar het {lang}, anders dan je schermtaal.',
  'translation.rescan':
    'Bon opnieuw scannen om naar het {lang} te vertalen (vervangt AI-regels)',

  'lang.label': 'Taal',
};

const de: Catalog = {
  'common.save': 'Speichern',
  'common.cancel': 'Abbrechen',
  'common.edit': 'Bearbeiten',
  'common.delete': 'Löschen',
  'common.add': 'Hinzufügen',
  'common.confirm': 'Bestätigen',
  'common.loading': 'Lädt…',
  'common.copied': 'Kopiert ✓',

  'nav.billList': 'AAbill',
  'nav.billDetail': 'Rechnungsdetails',

  'login.title': 'Bei AAbill anmelden',
  'login.google': 'Mit Google anmelden',
  'login.googleScriptFailed':
    'Google-Anmeldeskript konnte nicht geladen werden',
  'login.googleUnavailable': 'Google-Anmeldung nicht verfügbar',
  'login.devHint': 'Dev-Login: einfach eine E-Mail eingeben',
  'login.submit': 'Anmelden',
  'login.failed': 'Anmeldung fehlgeschlagen ({status})',

  'bills.mine': 'Meine Rechnungen',
  'bills.logout': 'Abmelden',
  'bills.titlePlaceholder': 'Titel der Rechnung (z. B. Metro 05-16)',
  'bills.create': 'Neu',
  'bills.empty':
    'Noch keine Rechnungen — fotografiere einen Beleg, um zu starten.',
  'bills.taxPending': 'Steuersatz offen',

  'bill.upload': 'Rechnung hochladen (Bild oder PDF)',
  'bill.reupload': 'Rechnung neu erkennen (ersetzt KI-Zeilen)',
  'bill.viewInvoice': 'Originalrechnung ansehen ↗',
  'bill.printedTotals': 'Gedruckte Summen (€)',
  'bill.net': 'Netto',
  'bill.vatA': 'MwSt. A',
  'bill.vatB': 'MwSt. B',
  'bill.gross': 'Brutto',
  'bill.saveAndValidate': 'Summen speichern und prüfen',
  'bill.items': 'Positionen ({n})',
  'bill.addRow': '＋ Zeile manuell hinzufügen',
  'bill.newItem': 'Neue Position',
  'bill.families': 'Haushalte',
  'bill.noFamilies':
    '⚠️ Noch keine Haushalte — wer den Teilen-Link öffnet, kann nichts beanspruchen. Bitte zuerst hinzufügen.',
  'bill.share': 'Zum Beanspruchen teilen',
  'bill.copyLink': 'Teilen-Link kopieren',
  'bill.claimProgress': 'Beansprucht: {done}/{total}',
  'bill.lockedSuffix': ' · gesperrt',
  'bill.summary': 'Aufteilungsübersicht',
  'bill.copySummary': 'Übersicht kopieren',
  'bill.lock': 'Rechnung sperren (Positionen und Ansprüche endgültig)',
  'bill.lockHint':
    'Sobald alles beansprucht ist, erscheinen hier Übersicht und Sperr-Button.',
  'bill.parsing':
    'Erkennung läuft (mehrseitige Rechnungen dauern bis zu einer Minute)…',
  'bill.parseTimeout':
    'Zeitüberschreitung bei der Erkennung — gleich neu laden oder erneut versuchen',
  'bill.savingTotals': 'Summen werden gespeichert…',
  'bill.badAmount': 'Ungültiger Betrag (höchstens zwei Nachkommastellen)',
  'bill.adding': 'Zeile wird hinzugefügt…',
  'bill.saving': 'Wird gespeichert…',
  'bill.deleting': 'Wird gelöscht…',
  'bill.addingFamily': 'Haushalt wird hinzugefügt…',
  'bill.removingFamily': 'Haushalt wird entfernt…',
  'bill.savingTax': 'Steuersatz wird gespeichert…',
  'bill.locking': 'Wird gesperrt…',

  'validate.ok': '✓ Stimmt mit den gedruckten Summen überein',
  'validate.near': '✓ Nahezu gleich ({amount} € Differenz durch Rundung)',
  'validate.mismatch': 'Summen stimmen nicht — bitte Positionen prüfen:',
  'validate.netDiff': 'Differenz netto',
  'validate.vatADiff': 'Differenz MwSt. A',
  'validate.vatBDiff': 'Differenz MwSt. B',
  'validate.grossDiff': 'Differenz brutto',

  'family.placeholder': 'Name des Haushalts (z. B. Familie Rio)',

  'item.name': 'Name',
  'item.nameTranslated': 'Übersetzter Name',
  'item.qty': 'Menge',
  'item.unitPrice': 'Nettopreis €',
  'item.taxClass': 'Steuerklasse {cls}',
  'item.shared': 'Gleichmäßig teilen',

  'claim.lockedNotice':
    'Diese Rechnung ist gesperrt — Ansprüche lassen sich nicht mehr ändern',
  'claim.whichFamily': 'Welcher Haushalt bist du?',
  'claim.noFamilies':
    'Die Ersteller:in hat noch keine Haushalte angelegt, daher lässt sich nichts beanspruchen.',
  'claim.noFamiliesHint':
    'Bitte darum, alle unter „Haushalte“ auf der Rechnungsseite einzutragen, und lade diese Seite neu.',
  'claim.pickFamilyFirst':
    'Wähle zuerst deinen Haushalt und hake dann an, was du gekauft hast.',
  'claim.photo': '📷 Per Foto beanspruchen (KI wählt vor)',
  'claim.photoBusy': 'KI schaut nach…',
  'claim.photoHint':
    'Fotografiere, was du gekauft hast; die KI rät, welche Positionen dir gehören — du bestätigst.',
  'claim.photoFailed': 'Foto-Erkennung fehlgeschlagen: {error}',
  'claim.items': 'Positionen ({n})',
  'claim.chosen': '{kinds} Sorten gewählt / {units} Stück gesamt',
  'claim.estimated': 'Voraussichtlich {amount} €',
  'claim.exclTax': ' (ohne MwSt.)',
  'claim.netPlusTax':
    'Netto {amount} € zzgl. MwSt.; maßgeblich ist die gesperrte Übersicht.',
  'claim.noTaxYet':
    'Der Steuersatz steht noch nicht fest, daher wird nur der Nettobetrag gezeigt; maßgeblich ist die gesperrte Übersicht.',
  'claim.submit': 'Meine Ansprüche absenden',
  'claim.submitting': 'Wird gesendet…',
  'claim.submitted': '✓ Gesendet — jetzt für alle sichtbar',
  'claim.autoSync':
    'Ansprüche der anderen Haushalte werden alle 5 Sekunden aktualisiert.',
  'claim.conflict':
    'Du wolltest {requested}, aber andere haben bereits {claimedByOthers} beansprucht — nur noch {available} übrig',
  'claim.conflictHint':
    'Jemand war schneller. Passe die markierten Positionen an und sende erneut.',
  'claim.sharedItem':
    'Gleichmäßig auf alle Haushalte verteilt — kein Anspruch nötig',
  'claim.perPiece': '{price} €/St. · {total} St. gesamt',
  'claim.othersClaimed': 'Andere haben {others} · noch {remaining} übrig',
  'claim.iTake': 'Ich nehme ',
  'claim.pieces': ' St.',
  'claim.typeDirectly': 'Direkt eingeben:',
  'claim.ofPieces': '/ {n} St.',
  'claim.invalidQty': 'Bitte 0 oder eine positive ganze Zahl eingeben',
  'claim.maxQty': 'Höchstens {n} verfügbar',

  'suggest.warning':
    '⚠️ Das sind Vermutungen der KI anhand deines Fotos und können falsch oder unvollständig sein — bitte einzeln prüfen.',
  'suggest.none':
    'Die KI hat keine Position dieser Rechnung erkannt. Versuche einen anderen Winkel oder hake unten manuell an.',
  'suggest.confirm': 'Auswahl beanspruchen ({n})',
  'suggest.perPiece': '{n} St. · {price} €/St.',

  'settlement.total': 'Gesamt',
  'settlement.breakdown': 'netto {net} + MwSt. {vat}',
  'settlement.summaryTitle': '{title} · Aufteilungsübersicht',
  'settlement.summaryLine': '{name}: {gross} € (netto {net} + MwSt. {vat})',
  'settlement.summaryTotal': 'Gesamt: {gross} €',

  'tax.settled': 'MwSt. {country} {code}',
  'tax.settledWithRates': 'MwSt. {country} {code} · {a} / {b}',
  'tax.pending': 'Steuersatz offen — zum Auswählen tippen',
  'tax.pickCountry': 'Land dieser Rechnung wählen',
  'tax.pickHint':
    'Die auf der Rechnung gedruckten Sätze haben Vorrang; dieses Land dient nur als Rückfall, wenn sie nicht lesbar sind.',
  'tax.searchPlaceholder': 'Land oder Code suchen',
  'tax.noMatch': 'Kein passendes Land',
  'tax.multiReduced': '{country} hat mehrere ermäßigte Sätze',
  'tax.multiReducedHint':
    'Welcher gilt, hängt von der Ware ab; Raten würde den Betrag verfälschen. Wähle den Satz von deiner Rechnung:',

  'translation.mismatch':
    'Die Artikelnamen dieser Rechnung sind auf {lang} übersetzt — anders als deine Anzeigesprache.',
  'translation.rescan':
    'Rechnung neu erkennen und auf {lang} übersetzen (ersetzt KI-Zeilen)',

  'lang.label': 'Sprache',
};

export const CATALOGS: Record<Lang, Catalog> = { zh, en, nl, de };
