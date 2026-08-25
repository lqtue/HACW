// One-off: bake the survey team's authored copy + quiz questions (2026-08-25 batch) into
// src/lib/data/destinations.json. Re-runnable — it replaces the same fields each time.
//   node scripts/bake-content.mjs
// Source convention: the FIRST option is the correct one; options are shuffled here with a
// seed from the question text so the answer index is stable across runs. Questions that
// depend on a photo we don't have, or have < 3 options, are skipped and listed.
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../src/lib/data/destinations.json', import.meta.url);
const data = JSON.parse(readFileSync(FILE, 'utf8'));

const B = (vi, en) => ({ vi, en });
// q(vi, en, [opts as [vi,en] ×3], explain?) — first option is the right one
const q = (vi, en, opts, explain) => ({ vi, en, opts, explain });

/** @type {Record<string, any>} */
const CONTENT = {
  'chua-quan-am': {
    address: '26 Trần Phú', hours: '7:30 - 19:30',
    short: B('Tịnh cảnh đối phồn hoa, cửa chùa luôn tự tại', 'A quiet realm facing the bustle; the pagoda gate stays at ease'),
    description: B(
      'Cách Miếu Quan Công một khoảng vườn thanh tịnh làm nao lòng du khách, ngôi chùa là chốn tự tại giữa cảnh phồn hoa, giữ gìn nếp cũ người Minh Hương.',
      'Set a tranquil garden away from the Quan Cong Temple, the pagoda is a place of ease amid the bustle, keeping the old ways of the Minh Hương community.'
    ),
    highlights: [
      B('Bài trí giản dị với tượng thờ và tranh vẽ phía sau', 'A simple layout: statues with painted panels behind them'),
      B('Bộ tranh mười tám vị La Hán', 'The set of paintings of the eighteen Arhats'),
      B('Tượng Phật Bà ở sân trong, giữa tiểu cảnh và hồ nước nhỏ', 'The Quan Am statue in the inner courtyard, among rockery and a small pond')
    ],
    quiz: [
      q('Tại sao vị bồ tát này lại có ngoại hình dữ tợn?', 'Why does this bodhisattva look so fierce?',
        [['Để hàng phục quỷ đói', 'To subdue the hungry ghosts'], ['Để tăng uy thế cho điện thờ', 'To add majesty to the shrine'], ['Để bảo vệ linh tháp', 'To guard the sacred tower']],
        B('Tiêu Diện Đại Sĩ là một hóa thân của Quan Thế Âm Bồ Tát, cai quản, nhiếp phục loài ngạ quỷ (quỷ đói) và cứu độ chúng sinh lầm đường lạc lối. Đối diện với Tiêu Diện Đại Sĩ là Vi Đà Tôn Thiên, mang sắc tướng khôi ngô, là người bảo vệ. Hai vị cũng được gọi là Ông Thiện và Ông Ác.',
          'Tiêu Diện Đại Sĩ is a manifestation of Avalokiteśvara who governs and subdues the hungry ghosts and rescues beings who have lost their way. Facing him is Vi Đà Tôn Thiên, handsome in form, the guardian. Together they are known as Mr Good and Mr Evil.')),
      q('Quan Thế Âm Bồ Tát cầm gì trên tay trái?', 'What does Quan Am hold in her left hand?',
        [['Bình tịnh thuỷ', 'A vase of pure water'], ['Nhành dương liễu', 'A willow branch'], ['Bình hồ lô', 'A gourd bottle']],
        B('Tay trái Quan Âm cầm bình thanh tịnh đựng nước cam lồ, biểu trưng cho lòng từ bi. Tay phải bà cầm nhành dương liễu để rưới nước cam lồ cho lòng người mát mẻ. Nước này rưới đến đâu là chan rải tình thương đến đó, xoa dịu mọi khổ đau của chúng sanh.',
          'Her left hand holds the vase of pure nectar, a symbol of compassion. Her right hand holds a willow branch to sprinkle that nectar and cool the heart. Wherever it falls, love spreads and the suffering of all beings is soothed.'))
    ]
  },

  'mieu-quan-cong': {
    address: '24 Trần Phú', hours: '7:30 - 19:30',
    short: B('Nổi bật với sắc đỏ uy phong lẫm liệt của lòng chính trực.', 'Striking in the majestic red of righteousness.'),
    description: B(
      'Một di tích lâu đời chứng kiến những đổi thay của phố Hội. Nhiều hợp đồng thương mại đã từng được ký kết ở nơi đây, dưới sự chứng giám của Quan Thánh.',
      'An ancient monument that has witnessed Hội An change. Many trade contracts were once signed here, with Quan Thánh as witness.'
    ),
    highlights: [
      B('Hoành phi được tiến cúng bởi các hội quán người Hoa khác nhau', 'Horizontal boards donated by the various Chinese assembly halls'),
      B('Bài thơ của Xuân Quận công Nguyễn Nghiễm', 'The poem by Duke Nguyễn Nghiễm'),
      B('Tượng Quan Công, hai đệ tử cùng ngựa Xích Thố và Bạch Thố', 'Statues of Quan Công, his two attendants and the horses Xích Thố and Bạch Thố')
    ],
    quiz: [
      q('Tại sao Quan Thánh Đế Quân (Quan Công) lại được thờ phụng ở Hội An?', 'Why is Quan Thánh Đế Quân (Quan Công) worshipped in Hội An?',
        [['Ngài là tấm gương nghĩa khí', 'He is a model of loyalty and righteousness'], ['Ngài đảm bảo sự an toàn cho phố cảng', 'He keeps the port town safe'], ['Ngài có khả năng chữa bệnh', 'He can heal the sick']],
        B('Tri huyện Trương Tăng Diễn từng cúng một câu đối thể hiện uy linh của Quan Thánh Đế Quân với người Việt: “Nhất điểm đan tâm tồn Bắc sử; Thiên thu nghĩa khí tráng Nam cương” (Một tấm lòng son lưu sử Bắc; Ngàn năm nghĩa khí tráng Nam cương). Đặc biệt, thương nhân ở Hội An còn coi Ngài là bậc Thánh chứng cho chữ tín trong giao thương và trừng phạt những kẻ vi phạm khế ước.',
          'District chief Trương Tăng Diễn donated a couplet on his standing among the Vietnamese: “One loyal heart lives on in Northern history; a thousand years of righteousness strengthen the Southern frontier.” Hội An\'s merchants also held him as the Saint who witnesses good faith in trade and punishes those who break a contract.')),
      q('Nhìn theo hướng từ chính điện ra, con ngựa bên trái Quan Công có màu gì?', 'Looking out from the main hall, what colour is the horse on Quan Công\'s left?',
        [['Đỏ', 'Red'], ['Trắng', 'White'], ['Đen', 'Black']],
        B('Phía bên trái của Quan Công là tượng ngựa Xích Thố, toàn thân một màu đỏ rực như lửa. Trong tiểu thuyết “Tam Quốc diễn nghĩa”, Xích Thố đã qua nhiều đời chủ rồi gắn bó với nhân vật Quan Vũ. Sau khi Quan Vũ mất, ngựa bỏ ăn mà chết để bày tỏ lòng trung thành.',
          'On his left stands Xích Thố (Red Hare), fiery red all over. In the Romance of the Three Kingdoms the horse passed through several masters before bonding with Quan Vũ; after his death it refused food and died out of loyalty.')),
      q('Bức tranh phía bên trái từ trong chính điện nhìn ra vẽ cảnh gì?', 'Looking out from the main hall, what scene does the painting on the left show?',
        [['Quan Công phò nhị tẩu (hộ tống hai người chị dâu)', 'Quan Công escorting his two sisters-in-law'], ['Đào viên kết nghĩa (Kết nghĩa ở vườn đào)', 'The oath of brotherhood in the peach garden'], ['Tam cố mao lư (Ba lần đến nhà tranh)', 'Three visits to the thatched cottage']],
        B('Trong tranh, Quan Vũ hộ tống hai người vợ của Lưu Bị vượt qua năm cửa ải của Tào Tháo và chém sáu tướng cản đường để trở về với Lưu Bị. Ở phía bức tường còn lại, vẽ cảnh Châu Thương xin quy phục Quan Vũ. Cả thiên truyện “vượt năm ải, chém sáu tướng” ca ngợi lòng trung thành và tiết nghĩa tuyệt đối của Quan Vũ. Châu Thương là người cầm Thanh Long yển nguyệt đao đứng phía tay trái Quan Công trong miếu này.',
          'Quan Vũ escorts Liu Bei\'s two wives through Cao Cao\'s five passes, slaying six generals who bar the way, to return to Liu Bei. The opposite wall shows Châu Thương pledging himself to Quan Vũ. The tale of “five passes, six generals” celebrates his absolute loyalty. Châu Thương is the figure holding the Green Dragon crescent blade on Quan Công\'s left in this temple.'))
    ]
  },

  'bao-tang-gom-su-mau-dich': { address: '80 Trần Phú', hours: '7:00 - 21:00', quiz: [] },
  'bao-tang-sa-huynh': { address: '149 Trần Phú', hours: '8:00 - 21:00', quiz: [] },

  'bao-tang-nghe-y': {
    address: '34 Nguyễn Thái Học', hours: '8:00 - 21:30',
    quiz: [
      q('Thầy thuốc đặt tay lên cổ tay bệnh nhân nhằm mục đích gì?', 'Why does the physician place fingers on the patient\'s wrist?',
        [['Xác định tình trạng tạng phủ, khí huyết', 'To read the state of the organs, qi and blood'], ['Khám tình trạng cổ tay', 'To examine the wrist itself'], ['Chẩn đoán thai sản', 'To diagnose pregnancy']]),
      q('Vị thuốc nào được mệnh danh là “nhân sâm của người nghèo”?', 'Which herb is called “the poor man\'s ginseng”?',
        [['Cây đinh lăng', 'Đinh lăng (Polyscias)'], ['Cây ngải cứu', 'Mugwort'], ['Cây tía tô', 'Perilla']]),
      q('Siêu sắc thuốc xưa cần phải đảm bảo tính chất nào?', 'What must a traditional herb-decoction pot guarantee?',
        [['Không ảnh hưởng đến tính vị của thuốc', 'It must not alter the medicine\'s nature and taste'], ['Cách nhiệt khi đun', 'Insulate heat while boiling'], ['Có thể chống tràn', 'Prevent boiling over']])
    ]
  },

  'bao-tang-van-hoa-dan-gian': {
    address: '33 Nguyễn Thái Học', hours: '8:00 - 21:30',
    quiz: [
      q('Người ta bắt tôm vào thời điểm nào trong ngày?', 'At what time of day are shrimp caught?',
        [['Đêm', 'At night'], ['Sáng sớm', 'Early morning'], ['Chiều', 'Afternoon']]),
      q('Trong các ngày hội lớn, người dân bản địa thường chơi trò chơi dân gian nào?', 'Which folk game do locals play at the big festivals?',
        [['Bài chòi', 'Bài chòi (sung card game)'], ['Tổ tôm điếm', 'Tổ tôm điếm'], ['Cờ người', 'Human chess']]),
      q('Làng mộc nổi tiếng ở Hội An có tên là gì?', 'What is Hội An\'s famous carpentry village called?',
        [['Kim Bồng', 'Kim Bồng'], ['Trà Quế', 'Trà Quế'], ['Thanh Hà', 'Thanh Hà']])
    ]
  },

  'bao-tang-tho-san': {
    address: '57 Trần Phú', hours: '8:00 - 21:30',
    short: B('Mặt hàng nào đã được giao thương ở Hội An? Một lát cắt về mạng lưới thương mại thế kỷ XVI-XVII', 'What was traded in Hội An? A slice of the 16th–17th-century trade network'),
    description: B(
      'Thổ sản là một trong những mặt hàng được xuất khẩu qua thương cảng Hội An. Từ thế kỷ XVI, các thuyền buôn Bồ Đào Nha đã đến đây mua hàng như tơ, lụa, hồ tiêu, gỗ quý, thông qua các đại lý người Hoa hay người Nhật.',
      'Local produce was among the goods exported through the port of Hội An. From the 16th century Portuguese merchant ships came here to buy silk, pepper and precious woods through Chinese or Japanese agents.'
    ),
    highlights: [
      B('Quá trình khai thác kỳ nam, lâm sản quý hiếm bậc nhất', 'How kỳ nam, the rarest forest product, was harvested'),
      B('Giá cả và tầm quan trọng của từng mặt hàng trong thị trường thổ sản', 'Prices and importance of each product in the local-produce market'),
      B('Những vật dụng sử dụng trong buôn bán', 'The tools of trade')
    ],
    quiz: [
      q('Trong số các sản vật này, sản vật nào là quý hiếm và đắt giá nhất?', 'Which of these products was the rarest and most expensive?',
        [['Kỳ nam', 'Kỳ nam (finest agarwood)'], ['Trầm hương', 'Agarwood'], ['Quế', 'Cinnamon']]),
      q('Loại sản vật nào xuất hiện trên Cửu Đỉnh?', 'Which product appears on the Nine Dynastic Urns (Cửu Đỉnh)?',
        [['Cau', 'Areca nut'], ['Tiêu', 'Pepper'], ['Lá lao', 'Lao leaf']])
    ]
  },

  'nha-tho-toc-tran': {
    address: '21 Lê Lợi', hours: '7:00 - 21:00',
    quiz: [
      q('Con hổ trong bức tranh ở phòng khách đang làm gì?', 'What is the tiger in the living-room painting doing?',
        [['Gầm', 'Roaring'], ['Nhảy qua suối', 'Leaping a stream'], ['Ngồi', 'Sitting']]),
      q('Khi muốn xin ý kiến của tổ tiên, chủ nhà sẽ thực hiện hành động gì?', 'To ask the ancestors\' opinion, what does the head of the house do?',
        [['Xin đài âm dương', 'Cast the yin-yang coins'], ['Xin giáng bút', 'Ask for spirit writing'], ['Xin báo mộng', 'Ask for a dream omen']])
    ]
  },

  'nha-tho-toc-nguyen-tuong': {
    address: '8/2 Nguyễn Thị Minh Khai', hours: '8:00 - 21:00',
    quiz: [
      q('Ngôi nhà này được xây dựng bởi ai?', 'Who built this house?',
        [['Một vị thượng thư triều Nguyễn', 'A minister of the Nguyễn court'], ['Một nhà văn', 'A writer'], ['Một hoạ sĩ', 'A painter']]),
      q('Phần trung tâm của ngôi nhà này được sử dụng để làm gì?', 'What is the central part of the house used for?',
        [['Thờ cúng', 'Ancestor worship'], ['Tiếp khách', 'Receiving guests'], ['Sáng tác văn chương', 'Writing literature']]),
      q('Tác giả nào là hậu duệ của tộc Nguyễn Tường?', 'Which author is a descendant of the Nguyễn Tường clan?',
        [['Thạch Lam', 'Thạch Lam'], ['Khái Hưng', 'Khái Hưng'], ['Nguyên Hồng', 'Nguyên Hồng']],
        B('Thạch Lam là hậu duệ của dòng họ khoa bảng Nguyễn Tường. Tuy vậy, cuộc đời sáng tác của ông gắn liền với phố huyện Cẩm Giàng (Hải Dương) và Hà Nội. Ông viết về một chiều hoàng hôn ở phố huyện tù đọng và bị lề hóa: “Tiếng trống thu không trên cái chòi của huyện nhỏ; từng tiếng một vang ra để gọi buổi chiều. Phương tây đỏ rực như lửa cháy và những áng mây ánh hồng như hòn than sắp tàn. [...] Chiều, chiều rồi. Một chiều êm ả như ru, văng vẳng tiếng ếch nhái kêu ra ngoài đồng ruộng theo gió nhẹ đưa vào.”',
          'Thạch Lam descends from the scholarly Nguyễn Tường line, though his writing life belonged to the district town of Cẩm Giàng (Hải Dương) and Hà Nội. He wrote of dusk in a stagnant, forgotten district town: “The evening drum on the little district watchtower, one beat after another, calling in the dusk. The west blazed red as fire and the clouds glowed pink like embers about to die… Evening, evening now. An evening as gentle as a lullaby, the frogs calling faintly from the fields on a light breeze.”'))
    ]
  },

  'nha-co-phung-hung': {
    address: '4 Nguyễn Thị Minh Khai', hours: '8:00 - 18:00',
    quiz: [
      q('Bộ tranh này được tạo ra bằng kĩ nghệ gì?', 'What craft technique made this set of panels?',
        [['Cẩn xà cừ', 'Mother-of-pearl inlay'], ['Ghép sành sứ', 'Ceramic mosaic'], ['Pháp lam', 'Enamel (pháp lam)']]),
      q('Bộ tượng này là nhân hóa của các giá trị gì?', 'Which values do these three statues personify?',
        [['Phúc - Lộc - Thọ', 'Fortune, Prosperity, Longevity'], ['Nhân - Lễ - Nghĩa', 'Benevolence, Propriety, Righteousness'], ['Tòng Phụ - Tòng Phu - Tòng Tử', 'The three obediences']])
    ]
  },

  'nha-co-quan-thang': {
    address: '77 Trần Phú', hours: '9:00 - 19:00',
    quiz: [
      q('Chủ nhân đầu tiên của ngôi nhà này là ai?', 'Who was the first owner of this house?',
        [['Thương nhân kinh doanh hàng hóa quý hiếm', 'A merchant in rare goods'], ['Thương nhân buôn gốm', 'A ceramics trader'], ['Chủ hiệu sách', 'A bookshop owner']]),
      q('Hình ảnh được chạm trên cuốn thư ở giếng trời là gì?', 'What is carved on the scroll panel in the light well?',
        [['Cây tùng và hươu', 'Pine and deer'], ['Cây tùng và hạc', 'Pine and crane'], ['Hoa cúc và chim trĩ', 'Chrysanthemum and pheasant']])
    ]
  },

  'nha-co-duc-an': {
    address: '129 Trần Phú', hours: '9:00 - 19:00',
    quiz: [
      q('Trước kia nhà Đức An từng bán sách của tác giả nào?', 'Whose books did the Đức An shop once sell?',
        [['Sách của Khang Hữu Vi, Lương Khải Siêu', 'Kang Youwei and Liang Qichao'], ['Sách của Cù Thu Bạch', 'Qu Qiubai'], ['Sách của Hà Ân Chấn', 'Hà Ân Chấn']]),
      q('Vì sao hiệu Đức An chuyển sang bán thuốc bắc?', 'Why did Đức An switch to selling Chinese medicine?',
        [['Thực dân Pháp đàn áp Trung Kỳ dân biến', 'The French crushed the Central Vietnam uprising'], ['Việc bán sách không còn thu được lợi nhuận', 'Bookselling stopped being profitable'], ['Hiệu Đức An gặp được nguồn cung thuốc tốt', 'They found a good supply of medicine']]),
      q('Từ năm 1927 đến năm 1934, chủ nhà Đức An đã sử dụng nơi này để tổ chức những hoạt động gì?', 'From 1927 to 1934, what did the owner of Đức An use this house for?',
        [['Liên lạc, hội họp của phong trào cách mạng', 'Meetings and liaison for the revolutionary movement'], ['Gặp gỡ các cầu thủ của đội bóng Ô-rô', 'Meeting players of the Ô-rô football team'], ['Chẩn bệnh miễn phí cho người nghèo', 'Free medical consultations for the poor']])
    ]
  },

  'nha-co-tan-ky': {
    address: '101 Nguyễn Thái Học', hours: '8:30 - 18:00',
    quiz: [
      q('Hiệu Tấn Ký từng buôn bán những mặt hàng nào?', 'What goods did the Tấn Ký shop trade in?',
        [['Nông sản', 'Farm produce'], ['Sách báo', 'Books and papers'], ['Y phục', 'Clothing']])
    ]
  },

  'hoi-quan-quang-trieu': {
    address: '176 Trần Phú', hours: '8:00 - 17:00',
    short: B('Uy nghi, bề thế, và mực thước trong nghệ thuật kể chuyện', 'Stately, imposing and measured in the art of storytelling'),
    description: B(
      'Dưới những nếp mái vuông vức là không gian trang nghiêm, được trang trí bằng cổ điển Trung Hoa.',
      'Under the square-set roofs is a solemn space decorated with the Chinese classics.'
    ),
    highlights: [B('Tác phẩm “ngư long hý thuỷ”', 'The “fish and dragon playing in water” piece')],
    quiz: [
      q('Ba người này đang ở đâu?', 'Where are these three men?',
        [['Vườn đào', 'A peach garden'], ['Núi tùng', 'A pine mountain'], ['Vườn trúc', 'A bamboo garden']],
        B('Bức tranh vẽ cảnh kết nghĩa vườn đào của ba anh em Lưu Bị, Quan Vũ và Trương Phi với lời thề "Tuy không sinh cùng ngày cùng tháng cùng năm, nhưng nguyện chết cùng ngày cùng tháng cùng năm", nguyện dốc sức vì nước, cứu dân an đời.',
          'The painting shows the peach-garden oath of Liu Bei, Quan Vũ and Zhang Fei: “Though not born on the same day, month and year, we wish to die on the same day, month and year,” pledging themselves to the country and its people.')),
      q('Trong ba nhân vật, ai là Quan Vũ?', 'Of the three figures, which is Quan Vũ?',
        [['Người có mặt đỏ', 'The one with the red face'], ['Người có mặt đen', 'The one with the black face'], ['Người ở giữa có tai to', 'The one in the middle with big ears']]),
      q('Nhân vật nữ này đang bưng thức quả gì?', 'What fruit is this woman carrying?',
        [['Quả đào', 'Peaches'], ['Quả phật thủ', 'Buddha\'s-hand citron'], ['Quả hồng', 'Persimmons']],
        B('Bức tranh “Ma Cô hiến thọ” vẽ lại cảnh tiên nữ Ma Cô mang đào tiên chúc thọ Tây Vương Mẫu. Đây chính là hình ảnh trang trí quen thuộc trên những chiếc đĩa cô tiên. Trong bức tranh ở Hội quán Quảng Triệu còn xuất hiện mô-típ tùng và hạc.',
          '“Ma Cô offers longevity” shows the fairy Ma Cô bringing immortal peaches to wish the Queen Mother of the West long life — the familiar scene on “fairy plates”. The version here also carries the pine-and-crane motif.'))
    ]
  },

  'hoi-quan-phuc-kien': {
    address: '46 Trần Phú', hours: '7:00 - 18:00',
    short: B('Hội quán tráng lệ nhất với những chi tiết trang trí tinh xảo làm từ gốm sứ và nhiều chất liệu khác.', 'The most splendid assembly hall, with exquisite decoration in ceramic and many other materials.'),
    description: B(
      'Hội quán tráng lệ nhất phố Hội, với những chi tiết trang trí tinh xảo, tái hiện hải trình của những thương nhân Phước Kiến cùng lòng thành kính với Thiên Hậu Thánh Mẫu.',
      'The most splendid assembly hall in Hội An, its fine decoration retelling the sea voyages of the Fujian merchants and their devotion to Thiên Hậu, the Holy Mother of the Sea.'
    ),
    highlights: [
      B('Cổng tam quan uy nghi', 'The imposing three-arched gate'),
      B('Mô hình thương thuyền vượt biển sống động', 'A vivid model of an ocean-going merchant ship'),
      B('Hoành phi và liễn đối do Ngô Lỗ, Trạng nguyên cuối cùng của lịch sử Tuyền Châu (Phước Kiến), cúng vào năm 1897', 'Boards and couplets donated in 1897 by Ngô Lỗ, the last top laureate in the history of Quanzhou (Fujian)')
    ],
    quiz: [
      q('Tại sao Hội quán Phước Kiến và nhiều hội quán khác của người Hoa lại thờ bà Thiên Hậu? Gợi ý: Hãy quan sát những bức tranh và mô hình trong hội quán.', 'Why do the Fujian hall and many other Chinese halls worship Thiên Hậu? Hint: look at the paintings and models inside.',
        [['Để cầu bình an khi đi biển', 'For safety at sea'], ['Để cầu tài lộc', 'For wealth'], ['Để tưởng nhớ công dẹp giặc', 'To honour her for defeating invaders']],
        B('Ngay sau khi bước vào tiền điện, du khách sẽ thấy ở phía tường Đông là bích họa Thiên Hậu Thánh Mẫu cùng đệ tử cầm đèn lồng vượt sóng gió đến cứu người bị nạn và ở phía tường Tây là bích họa Lục Tánh Vương Gia cưỡi ngựa xung trận. Bên trong chính điện có mô hình thương thuyền được trang trí kỳ công với một gian thờ Thiên Hậu trên thuyền.',
          'Just inside the front hall, the east wall mural shows Thiên Hậu and her attendants carrying lanterns through the storm to rescue the shipwrecked; the west wall shows the Six Princes riding into battle. In the main hall stands an elaborately decorated model merchant ship with a shrine to Thiên Hậu on board.')),
      q('Hai vị thần được thờ phụng trong chính điện cùng Bà Thiên Hậu là ai?', 'Which two deities are worshipped in the main hall alongside Thiên Hậu?',
        [['Thiên Lý Nhãn - Thuận Phong Nhĩ', 'Thousand-League Eyes and Wind-Following Ears'], ['Thần Đồ - Uất Lũy', 'Shentu and Yulei'], ['Thanh Long - Bạch Hổ', 'Azure Dragon and White Tiger']],
        B('Hai vị thần phò tá Thiên Hậu Thánh Mẫu là Thiên Lý Nhãn và Thuận Phong Nhĩ. Thiên Lý Nhãn có thể nhìn thấy mọi việc ở khoảng cách rất xa, giúp Bà phát hiện tàu thuyền gặp nạn trên biển, còn Thuận Phong Nhĩ có thể nghe được tiếng kêu cứu từ muôn nơi theo chiều gió.',
          'Her two attendants are Thousand-League Eyes, who sees ships in distress from afar, and Wind-Following Ears, who hears cries for help carried on the wind from anywhere.')),
      q('Những đôi giày trong tủ kính dành cho ai?', 'Who were the shoes in the glass case made for?',
        [['Những người phụ nữ bó chân gót sen', 'Women with bound “lotus” feet'], ['Vũ công múa thủy tụ', 'Water-sleeve dancers'], ['Tượng thờ các vị thần', 'The statues of the gods']],
        B('Tủ kính trưng bày các vật dụng của người Hoa xưa. Những đôi giày trong tủ được dùng khi bó chân gót sen. Tập tục này bắt đầu từ thời nhà Tống, được coi là biểu tượng của cái đẹp và địa vị. Đến thời nhà Thanh, tuy lệnh cấm được ban hành, song ít người tuân thủ. Đến thế kỷ XIX, có khoảng một nửa phụ nữ Trung Hoa thực hành bó chân.',
          'The case holds everyday objects of the old Chinese community. The shoes were worn on bound “lotus” feet, a custom begun in the Song dynasty as a mark of beauty and status. The Qing banned it with little effect; by the 19th century roughly half of Chinese women had bound feet.')),
      q('Bức tranh vẽ những đứa trẻ này được tìm thấy ở đâu?', 'Where is this painting of children found?',
        [['Án thờ 3 bà Chúa Sanh thai và 12 bà mụ', 'The altar of the three Birth Goddesses and twelve midwives'], ['Án thờ Lục Tánh vương gia', 'The altar of the Six Princes'], ['Nhà Đông', 'The east house']],
        B('Ba bà Chúa Sanh thai (Tam Tiêu Nương Nương) và 12 bà mụ lo việc tạo hình hài, ban phước, bảo trợ cho việc cầu tự (cầu con), thai kỳ bình an và mẹ tròn con vuông. Tượng 12 bà mụ thường khắc họa các vị trong các động tác chăm sóc, bồng bế trẻ thơ khác nhau.',
          'The three Birth Goddesses and twelve midwives shape the unborn, grant blessings and watch over prayers for children, a safe pregnancy and a safe birth. The twelve are usually shown tending and cradling infants in different poses.'))
    ]
  },

  'hoi-quan-hai-nam': {
    address: '10 Trần Phú', hours: '9:00 - 21:00',
    short: B('Giản dị song lại mang những chi tiết độc nhất, chứa đựng bề dày văn hoá Trung Hoa', 'Plain at first sight, yet full of unique details and deep Chinese culture'),
    description: B(
      'Sinh sau đẻ muộn và hiếm khi được ngợi ca là tráng lệ hay lộng lẫy, Hội quán Hải Nam như một cuốn sử phong phú khiến người ta ngỡ ngàng một khi bước vào trong.',
      'A latecomer rarely praised as splendid, the Hainan hall is a rich history book that surprises anyone who steps inside.'
    ),
    highlights: [
      B('Khúc bi hùng ca của 108 vị Chiêu Ứng Công', 'The tragic epic of the 108 Chiêu Ứng Công'),
      B('Hương án chính thếp vàng, được chạm lộng tinh vi với nhiều đề tài văn hoá', 'The gilded main altar, finely pierce-carved with cultural motifs'),
      B('Bộ cửa vẽ lại điển tích “Nhị thập tứ hiếu”', 'Doors painted with the “Twenty-four Filial Exemplars”'),
      B('Kiến trúc song mái độc nhất tại Hội An', 'The only double-roof structure in Hội An')
    ],
    quiz: [
      q('Tại sao Hội quán Hải Nam lại thờ 108 vị Chiêu Ứng Công?', 'Why does the Hainan hall worship the 108 Chiêu Ứng Công?',
        [['Tưởng nhớ 108 thương buôn chết oan đã hiển linh phù hộ thuyền bè trên biển', 'In memory of 108 wrongly killed merchants whose spirits protect ships at sea'], ['Tưởng nhớ công ơn 108 tiền hiền đã đặt nền móng cho bang Hải Nam', 'In memory of 108 founders of the Hainan community'], ['Tưởng nhớ oai linh 108 vị anh hùng Lương Sơn Bạc', 'In memory of the 108 heroes of Liangshan Marsh']],
        B('Mùa hạ năm 1851, 108 thương buôn người Hải Nam đã bị một số quan binh triều Nguyễn sát hại vì coi là cướp biển. Vua Tự Đức khi biết chuyện đã minh oan và sắc phong cho các vị là Chiêu Ứng Anh Liệt. Cặp liễn đối hai bên hương án chính có nghĩa: Khí khái tụ thành thần, theo dấu anh linh do oan trái; Đức độ xây nên miếu, thương kẻ đồng hương ở chốn xa.',
          'In the summer of 1851, 108 Hainanese merchants were killed by Nguyễn troops who took them for pirates. Emperor Tự Đức cleared their names and titled them Chiêu Ứng Anh Liệt. The couplet flanking the main altar reads: their spirit gathered into divinity, following the trace of a wrong; virtue built this shrine, in pity for countrymen far from home.')),
      q('Bao lam (cửa võng, rèm gỗ) ở cửa chính điện có đề tài gì?', 'What is the theme of the carved wooden valance at the main hall door?',
        [['Tùng thử bồ đào (sóc và dây nho)', 'Squirrels and grapevines'], ['Tùng - hạc', 'Pine and crane'], ['Hoa - điểu (hoa và chim muông)', 'Flowers and birds']],
        B('Tùng Thử Bồ Đào (松鼠葡萄) là đề tài kinh điển biểu trưng cho phú quý – sung túc – vạn sự hưng long. Hình ảnh sóc trèo nho thể hiện sự sinh sôi – đông con cháu, là lời chúc cát tường cho gia đạo thịnh vượng.',
          'Squirrels and grapes (松鼠葡萄) is a classic motif of wealth, abundance and flourishing. Squirrels climbing the vine stand for fertility and many descendants — a blessing for a prosperous household.'))
    ]
  },

  'hoi-quan-trieu-chau': {
    address: '362 Nguyễn Duy Hiệu', hours: '8:00 - 17:00',
    short: B('Nổi bật với các họa tiết trang trí gỗ phức tạp có tạo hình phong phú trong tầm mắt', 'Striking for its intricate, inventive wood carving at every glance'),
    description: B(
      'Hội quán Triều Châu sinh động với các chi tiết chạm gỗ trứ danh của người Tiều. Đề tài trang trí phong phú, tạo hình sáng tạo.',
      'The Teochew hall is alive with the renowned wood carving of the Teochew people — rich themes, inventive forms.'
    ),
    highlights: [
      B('Trang trí khác nhau ở hai bên vì kèo', 'Different decoration on the two sides of the roof trusses'),
      B('Khám thờ và bao lam chạm nhiều điển tích', 'Shrine and valances carved with many classical tales'),
      B('Hệ cửa chạm gỗ và vẽ kính sáng tạo', 'Inventive carved doors and reverse-glass painting')
    ],
    quiz: [
      q('Trên phần mái tiền điện có những đề tài trang trí gì?', 'What decorative themes are on the front-hall roof?',
        [['Lưỡng long triều dương, cá chép vượt long môn, bát tiên quá hải', 'Two dragons facing the sun, carp leaping the dragon gate, the Eight Immortals crossing the sea'], ['Lưỡng long tranh châu, lục quốc phong tướng', 'Two dragons contesting a pearl, the six states appointing a general'], ['Lưỡng long tranh bình hồ lô, ông Nhật - bà Nguyệt, các linh thú', 'Two dragons contesting a gourd, Sun and Moon, sacred beasts']])
    ]
  }
};

// questions we could not bake (need a photo we don't have, or lack 3 options)
const SKIPPED = {
  'bao-tang-gom-su-mau-dich': ['Họa tiết này nằm trong hiện vật nào? (ảnh)', 'Chú cua này — ai làm ra? (ảnh)', 'Chú cua còn nguyên sau vụ đắm tàu? (ảnh)'],
  'bao-tang-sa-huynh': ['Những chiếc chum này được dùng để làm gì? (không có đáp án)'],
  'nha-tho-toc-tran': ['Kết cấu kiến trúc này có tên là gì (Chèn ảnh)'],
  'nha-co-phung-hung': ['Chiếc cửa sập này dùng để làm gì? (chỉ 2 đáp án)'],
  'nha-co-quan-thang': ['Những con số này biểu thị điều gì? (chỉ 2 đáp án)'],
  'nha-co-tan-ky': ['Liễn đối “bách điểu” — Ảnh 1/2/3 (ảnh)', 'Buồng bên phải dùng để làm gì? (không có đáp án)'],
  'hoi-quan-phuc-kien': ['Hình ảnh nào là mái của Hội quán Phước Kiến? — Ảnh 1/2/3 (ảnh)'],
  'hoi-quan-hai-nam': ['Lân đực / lân cái — A/B (ảnh có nhãn)'],
  'hoi-quan-trieu-chau': ['Chú ngựa này — bạn của chú màu gì? (ảnh)', 'Hình ảnh này là đặc trưng của mùa nào? (ảnh)']
};

// deterministic shuffle from the question text so answer indexes don't churn between runs
function seeded(str) {
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
}
function toQuestion(src, i, n) {
  const rnd = seeded(src.vi);
  const idx = src.opts.map((_, k) => k);
  for (let k = idx.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [idx[k], idx[j]] = [idx[j], idx[k]]; }
  const out = {
    difficulty: n > 1 && i === n - 1 ? 'hard' : 'easy', // last one of a bank is the hard draw
    question: B(src.vi, src.en),
    options: idx.map((k) => B(src.opts[k][0], src.opts[k][1])),
    answer: idx.indexOf(0)
  };
  if (src.explain) out.explain = src.explain;
  return out;
}

const report = [];
for (const [id, c] of Object.entries(CONTENT)) {
  const d = data.find((x) => x.id === id);
  if (!d) { report.push(`!! ${id}: not in destinations.json`); continue; }
  if (c.address) d.address = B(c.address, c.address);
  if (c.hours) d.hours = B(c.hours, c.hours);
  if (c.short) d.short = c.short;
  if (c.description) d.description = c.description;
  if (c.highlights) d.highlights = c.highlights;
  const fresh = c.quiz.map((s, i) => toQuestion(s, i, c.quiz.length));
  if (fresh.length) {
    // real questions replace the generated filler; keep generated ones only to reach the
    // 2-easy + 1-hard draw when the batch is short
    const keep = (d.quizBank ?? []).filter((x) => x.generated);
    const need = Math.max(0, 3 - fresh.length);
    d.quizBank = [...fresh, ...keep.slice(0, need)];
  }
  report.push(`${id}: ${fresh.length} question(s)${c.short ? ' + copy' : ''}${SKIPPED[id] ? `  | skipped: ${SKIPPED[id].join('; ')}` : ''}`);
}
for (const id of Object.keys(SKIPPED)) if (!CONTENT[id]) report.push(`${id}: nothing baked | skipped: ${SKIPPED[id].join('; ')}`);

writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
console.log(report.join('\n'));
