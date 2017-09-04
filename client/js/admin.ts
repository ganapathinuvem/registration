class State {
	public id: string;
	private sectionElement: HTMLElement;

	public static hideAll() {
		// tslint:disable-next-line:no-use-before-declare
		states.forEach(state => state.hide());
	}

	constructor(id: string) {
		this.id = id;
		let element = document.querySelector(`section#${id}`);
		if (!element) {
			throw new Error("ID does not correspond to an existing <section> element");
		}
		this.sectionElement = element as HTMLElement;
	}
	public hide(): void {
		this.sectionElement.style.display = "none";
	}
	public show(hideAll: boolean = true): void {
		if (hideAll) {
			State.hideAll();
		}
		this.sectionElement.style.display = "block";
	}
}
const states: State[] = ["statistics", "users", "applicants", "settings"].map(id => new State(id));

class UserEntries {
	private static readonly NODE_COUNT = 10;
	private static nodes: HTMLTableRowElement[] = [];
	private static offset: number = 0;
	private static readonly previousButton = document.getElementById("users-entries-previous") as HTMLButtonElement;
	private static readonly nextButton = document.getElementById("users-entries-next") as HTMLButtonElement;

	private static instantiate() {
		const userEntryTemplate = document.getElementById("user-entry") as HTMLTemplateElement;
		const userEntryTableBody = document.querySelector("#users > table > tbody") as HTMLTableSectionElement;
		for (let i = this.nodes.length; i < this.NODE_COUNT; i++) {
			let node = document.importNode(userEntryTemplate.content, true);
			userEntryTableBody.appendChild(node);
			this.nodes.push(userEntryTableBody.querySelectorAll("tr")[i]);
		}
	}
	private static load() {
		const status = document.getElementById("users-entries-status") as HTMLParagraphElement;
		status.textContent = "Loading...";

		let query: { [index: string]: any } = {
			offset: this.offset,
			count: this.NODE_COUNT
		}
		let params = Object.keys(query)
			.map(key => encodeURIComponent(key) + "=" + encodeURIComponent(query[key]))
			.join("&")
			.replace(/%20/g, "+");
		fetch(`/api/admin/users?${params}`, {
			credentials: "same-origin",
			method: "GET"
		}).then(checkStatus).then(parseJSON).then((data: {
			offset: number;
			count: number;
			total: number;
			data: any[];
		}) => {
			for (let i = 0; i < this.NODE_COUNT; i++) {
				let node = this.nodes[i];
				let user = data.data[i];
				node.querySelector("td.name")!.textContent = user.name;
				node.querySelector("td.email > span")!.textContent = user.email;
				node.querySelector("td.email")!.classList.remove("verified", "notverified", "admin");
				if (user.verifiedEmail) {
					node.querySelector("td.email")!.classList.add("verified");
				}
				else {
					node.querySelector("td.email")!.classList.add("notverified");
				}
				if (user.admin) {
					node.querySelector("td.email")!.classList.add("admin");
				}
				node.querySelector("td.status")!.textContent = user.status;
				node.querySelector("td.login-method")!.textContent = user.loginMethods;
			}

			if (data.offset <= 0) {
				this.previousButton.disabled = true;
			}
			else {
				this.previousButton.disabled = false;
			}
			let upperBound = data.offset + data.count;
			if (upperBound >= data.total) {
				upperBound = data.total;
				this.nextButton.disabled = true;
			}
			else {
				this.nextButton.disabled = false;
			}
			status.textContent = `${data.offset + 1} – ${upperBound} of ${data.total.toLocaleString()}`;
		});
	}

	public static setup() {
		this.nodes = [];
		this.instantiate();
		this.offset = 0;
		this.load();
		this.previousButton.addEventListener("click", () => {
			this.previous();
		});
		this.nextButton.addEventListener("click", () => {
			this.next();
		});
	}
	public static next() {
		this.offset += this.NODE_COUNT;
		this.load();
	}
	public static previous() {
		this.offset -= this.NODE_COUNT;
		if (this.offset < 0) {
			this.offset = 0;
		}
		this.load();
	}
}

// Set the correct state on page load
function readURLHash() {
	let urlState: State | null = null;
	for (let i = 0; i < states.length; i++) {
		if (states[i].id === window.location.hash.substr(1)) {
			urlState = states[i];
			break;
		}
	}
	if (urlState) {
		urlState.show();
	}
	else {
		// Show first section
		states[0].show();
	}
}

(function setup() {
	readURLHash();
	UserEntries.setup();
})();
// Load the correct state on button press
window.addEventListener("hashchange", readURLHash);

//
// Applicants
//

const sendAcceptancesButton = document.getElementById("send-acceptances") as HTMLButtonElement;
sendAcceptancesButton.addEventListener("click", async e => {
	let sendCount: number = (await fetch(`/api/user/all/send_acceptances`, {
		credentials: "same-origin",
		method: "POST"
	}).then(checkStatus).then(parseJSON)).count;
	await sweetAlert("Success!", `Acceptance emails sent (${sendCount} in all).`, "success");
});

let branchFilter = document.getElementById("branchFilter") as HTMLInputElement;
branchFilter.addEventListener("change", e => {
	revealDivByClasses([branchFilter.value, getAcceptedFilterValue()]);
});

function getBranchFilterValue() {
	return branchFilter.value;
}

let acceptedFilter = document.getElementById("acceptedFilter") as HTMLInputElement;
acceptedFilter.addEventListener("change", e => {
	revealDivByClasses([getBranchFilterValue(), acceptedFilter.value]);
});

function getAcceptedFilterValue() {
	return acceptedFilter.value;
}

function updateFilterView() {
	revealDivByClasses([getBranchFilterValue(), getAcceptedFilterValue()]);
}

function revealDivByClasses(classes: string[]) {
	let elements = document.querySelectorAll(".applicantDiv") as NodeListOf<HTMLElement>;
	for (let i = 0; i < elements.length; i++) {
		let element = elements[i];
		let containsClasses: boolean = true;
		for (let j = 0; j < classes.length; j++) {
			let currentClass = classes[j];
			if (currentClass !== "*") {
				// If the class is a *, we ignore it, which makes filtering easier
				if (!element.classList.contains(currentClass)) {
					containsClasses = false;
				}
			}
		}

		if (containsClasses) {
			element.style.display = "";
		}
		else {
			element.style.display = "none";
		}
	}
}

// If an element has a class called accepted-true, for instance, and you want to toggle it, call flipClassValue(yourElement, "accepted", true)
function flipClassValue(el: Element, className: string, currentValue: boolean) {
	el.classList.remove(`${className}-${currentValue}`);
	el.classList.add(`${className}-${!currentValue}`);
}

let applicationStatusUpdateButtons = document.querySelectorAll(".statusButton") as NodeListOf<HTMLInputElement>;
for (let i = 0; i < applicationStatusUpdateButtons.length; i++) {
	let statusUpdateButton = applicationStatusUpdateButtons[i];

	statusUpdateButton.addEventListener("click", e => {
		let eventTarget = e.target as HTMLInputElement;

		e.preventDefault();
		eventTarget.disabled = true;

		let userId = eventTarget.dataset.user;
		let currentCondition = eventTarget.dataset.accepted === "true";

		let formData = new FormData();
		formData.append("status", (!currentCondition).toString());

		fetch(`/api/user/${userId}/status`, {
			credentials: "same-origin",
			method: "POST",
			body: formData
		}).then(checkStatus).then(parseJSON).then(async () => {
			eventTarget.disabled = false;
			if (!currentCondition) {
				// Set to Un-Accept
				flipClassValue(eventTarget, "accepted-btn", false);
				eventTarget.dataset.accepted = "true";
				eventTarget.textContent = "Un-Accept";
				flipClassValue(eventTarget.parentElement!.parentElement!, "accepted", false);
				flipClassValue(eventTarget.parentElement!.parentElement!.nextElementSibling!, "accepted", false);
			}
			else {
				// Set to Accept
				flipClassValue(eventTarget, "accepted-btn", true);
				eventTarget.dataset.accepted = "false";
				eventTarget.textContent = "Accept";
				flipClassValue(eventTarget!.parentElement!.parentElement!, "accepted", true);
				flipClassValue(eventTarget!.parentElement!.parentElement!.nextElementSibling!, "accepted", true);
			}

			updateFilterView();
			// Because we've added a class that implies the element should be removed, but haven't actually removed the element yet

		}).catch(async (err: Error) => {
			await sweetAlert("Oh no!", err.message, "error");
			eventTarget.disabled = false;
		});
	});
}

// So whatever the default filter options are set at, it'll show accordingly
updateFilterView();

//
// Email content
//
declare let SimpleMDE: any;

const emailTypeSelect = document.getElementById("email-type") as HTMLSelectElement;
let emailRenderedArea: HTMLElement | ShadowRoot = document.getElementById("email-rendered") as HTMLElement;
if (document.head.attachShadow) {
	// Browser supports Shadow DOM
	emailRenderedArea = emailRenderedArea.attachShadow({ mode: "open" });
}
const markdownEditor = new SimpleMDE({ element: document.getElementById("email-content")! });
let contentChanged = false;
let lastSelected = emailTypeSelect.value;

markdownEditor.codemirror.on("change", async () => {
	contentChanged = true;
	try {
		let content = new FormData();
		content.append("content", markdownEditor.value());

		let { html, text }: { html: string; text: string } = (
			await fetch(`/api/settings/email_content/${emailTypeSelect.value}/rendered`, {
				credentials: "same-origin",
				method: "POST",
				body: content
			}).then(checkStatus).then(parseJSON)
		);
		emailRenderedArea.innerHTML = html;
		let hr = document.createElement("hr");
		hr.style.border = "1px solid #737373";
		emailRenderedArea.appendChild(hr);
		let textContainer = document.createElement("pre");
		textContainer.textContent = text;
		emailRenderedArea.appendChild(textContainer);
	}
	catch (err) {
		emailRenderedArea.textContent = "Couldn't retrieve email content";
	}
});

async function emailTypeChange(): Promise<void> {
	if (contentChanged) {
		let shouldProceed = confirm("Heads up! You've edited the content of this email but haven't saved it. Click cancel to stay and save.");
		if (!shouldProceed) {
			emailTypeSelect.value = lastSelected;
			return;
		}
	}

	// Load editor content via AJAX
	try {
		let content = (await fetch(`/api/settings/email_content/${emailTypeSelect.value}`, { credentials: "same-origin" }).then(checkStatus).then(parseJSON)).content as string;
		markdownEditor.value(content);
	}
	catch (err) {
		markdownEditor.value("Couldn't retrieve email content");
	}
	contentChanged = false;
	lastSelected = emailTypeSelect.value;
}
emailTypeSelect.addEventListener("change", emailTypeChange);
emailTypeChange().catch(err => {
	console.error(err);
});

//
// Settings
//

// Load timezone-correct values for the application open / close time
let timeInputs = document.querySelectorAll('input[type="datetime-local"]') as NodeListOf<HTMLInputElement>;
for (let i = 0; i < timeInputs.length; i++) {
	timeInputs[i].value = moment(new Date(timeInputs[i].dataset.rawValue || "")).format("Y-MM-DDTHH:mm:00");
}

// Settings update
function parseDateTime(dateTime: string) {
	let digits = dateTime.split(/\D+/).map(num => parseInt(num, 10));
	return new Date(digits[0], digits[1] - 1, digits[2], digits[3], digits[4], digits[5] || 0, digits[6] || 0);
}
let settingsUpdateButton = document.querySelector("#settings input[type=submit]") as HTMLInputElement;
let settingsForm = document.querySelector("#settings form") as HTMLFormElement;
settingsUpdateButton.addEventListener("click", e => {
	if (!settingsForm.checkValidity() || !settingsForm.dataset.action) {
		return;
	}
	e.preventDefault();
	settingsUpdateButton.disabled = true;

	let applicationAvailabilityData = new FormData();
	applicationAvailabilityData.append("applicationOpen", parseDateTime((document.getElementById("application-open") as HTMLInputElement).value).toISOString());
	applicationAvailabilityData.append("applicationClose", parseDateTime((document.getElementById("application-close") as HTMLInputElement).value).toISOString());
	applicationAvailabilityData.append("confirmationOpen", parseDateTime((document.getElementById("confirmation-open") as HTMLInputElement).value).toISOString());
	applicationAvailabilityData.append("confirmationClose", parseDateTime((document.getElementById("confirmation-close") as HTMLInputElement).value).toISOString());

	let teamsEnabledData = new FormData();
	teamsEnabledData.append("enabled", (document.getElementById("teams-enabled") as HTMLInputElement).checked ? "true" : "false");

	let branchRoleData = new FormData();
	let branchRoles = document.querySelectorAll("div.branch-role") as NodeListOf<HTMLDivElement>;
	for (let i = 0; i < branchRoles.length; i++) {
		branchRoleData.append(branchRoles[i].dataset.name!, branchRoles[i].querySelector("select")!.value);
	}

	let emailContentData = new FormData();
	emailContentData.append("content", markdownEditor.value());

	const defaultOptions: RequestInit = {
		credentials: "same-origin",
		method: "PUT"
	};
	fetch("/api/settings/application_availability", {
		...defaultOptions,
		body: applicationAvailabilityData
	}).then(checkStatus).then(parseJSON).then(() => {
		return fetch("/api/settings/teams_enabled", {
			...defaultOptions,
			body: teamsEnabledData
		});
	}).then(checkStatus).then(parseJSON).then(() => {
		return fetch("/api/settings/branch_roles", {
			...defaultOptions,
			body: branchRoleData
		});
	}).then(checkStatus).then(parseJSON).then(() => {
		if (emailTypeSelect.value) {
			return fetch(`/api/settings/email_content/${emailTypeSelect.value}`, {
				...defaultOptions,
				body: emailContentData
			}).then(checkStatus).then(parseJSON);
		}
		else {
			return Promise.resolve();
		}
	}).then(async () => {
		await sweetAlert("Awesome!", "Settings successfully updated.", "success");
		window.location.reload();
	}).catch(async (err: Error) => {
		await sweetAlert("Oh no!", err.message, "error");
		settingsUpdateButton.disabled = false;
	});
});

//
// Graphs
//

// Embedded by Handlebars in admin.html
declare let data: {
	questionName: string;
	branch: string;
	responses: {
		response: string;
		count: number;
	}[];
}[];
declare const Chart: any;

// Get the text color and use that for graphs
const header = document.querySelector("#sidebar > h1") as HTMLHeadingElement;
const color = window.getComputedStyle(header).getPropertyValue("color");

for (let i = 0; i < data.length; i++) {
	let context = document.getElementById(`chart-${i}`) as HTMLCanvasElement | null;
	if (!context) {
		console.warn(`Canvas with ID "chart-${i}" does not exist`);
		continue;
	}

	new Chart(context, {
		"type": "bar",
		"data": {
			"labels": data[i].responses.map(response => response.response),
			"datasets": [{
				"label": data[i].questionName,
				"data": data[i].responses.map(response => response.count),
				"backgroundColor": Array(data[i].responses.length).fill(color)
			}]
		},
		"options": {
			"legend": {
				"display": false
			},
			"scales": {
				"yAxes": [{
					"ticks": {
						"fontColor": color,
						"beginAtZero": true,
						"callback": (value: number) => value % 1 === 0 ? value : undefined // Only integers
					},
					"gridLines": {
						"zeroLineColor": color
					}
				}],
				"xAxes": [{
					"stacked": false,
					"ticks": {
						"fontColor": color,
						"stepSize": 1,
						"autoSkip": false
					},
					"gridLines": {
						"zeroLineColor": color
					}
				}]
			}
		}
	});
}
