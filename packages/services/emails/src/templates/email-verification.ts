export function renderEmailVerificationEmail(params: { subject: string; verificationLink: string; toEmail: string }) {
  return `
<!doctype html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml"
	xmlns:o="urn:schemas-microsoft-com:office:office">

<head>
	<meta charset="UTF-8">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>${params.subject}</title>

	<style type="text/css">
		p {
			margin: 10px 0;
			padding: 0;
		}

		table {
			border-collapse: collapse;
		}

		h1,
		h2,
		h3,
		h4,
		h5,
		h6 {
			display: block;
			margin: 0;
			padding: 0;
		}

		img,
		a img {
			border: 0;
			height: auto;
			outline: none;
			text-decoration: none;
		}

		body,
		#bodyTable,
		#bodyCell {
			height: 100%;
			margin: 0;
			padding: 0;
			width: 100%;
		}

		.mcnPreviewText {
			display: none !important;
		}

		#outlook a {
			padding: 0;
		}

		img {
			-ms-interpolation-mode: bicubic;
		}

		table {
			mso-table-lspace: 0pt;
			mso-table-rspace: 0pt;
		}

		.ReadMsgBody {
			width: 100%;
		}

		.ExternalClass {
			width: 100%;
		}

		p,
		a,
		li,
		td,
		blockquote {
			mso-line-height-rule: exactly;
		}

		a[href^=tel],
		a[href^=sms] {
			color: inherit;
			cursor: default;
			text-decoration: none;
		}

		p,
		a,
		li,
		td,
		body,
		table,
		blockquote {
			-ms-text-size-adjust: 100%;
			-webkit-text-size-adjust: 100%;
		}

		.ExternalClass,
		.ExternalClass p,
		.ExternalClass td,
		.ExternalClass div,
		.ExternalClass span,
		.ExternalClass font {
			line-height: 100%;
		}

		a[x-apple-data-detectors] {
			color: inherit !important;
			text-decoration: none !important;
			font-size: inherit !important;
			font-family: inherit !important;
			font-weight: inherit !important;
			line-height: inherit !important;
		}

		.templateContainer {
			max-width: 600px !important;
		}

		a.mcnButton {
			display: block;
		}

		.mcnImage,
		.mcnRetinaImage {
			vertical-align: bottom;
		}

		.mcnTextContent {
			word-break: break-word;
		}

		.mcnTextContent img {
			height: auto !important;
		}

		.mcnDividerBlock {
			table-layout: fixed !important;
		}

		/*
	@tab Page
	@section Heading 1
	@style heading 1
	*/
		h1 {
			/*@editable*/
			color: #222222;
			/*@editable*/
			font-family: 'Open Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
			/*@editable*/
			font-size: 40px;
			/*@editable*/
			font-style: normal;
			/*@editable*/
			font-weight: bold;
			/*@editable*/
			line-height: 150%;
			/*@editable*/
			letter-spacing: normal;
			/*@editable*/
			text-align: center;
		}

		/*
	@tab Page
	@section Heading 2
	@style heading 2
	*/
		h2 {
			/*@editable*/
			color: #222222;
			/*@editable*/
			font-family: Helvetica;
			/*@editable*/
			font-size: 34px;
			/*@editable*/
			font-style: normal;
			/*@editable*/
			font-weight: bold;
			/*@editable*/
			line-height: 150%;
			/*@editable*/
			letter-spacing: normal;
			/*@editable*/
			text-align: left;
		}

		/*
	@tab Page
	@section Heading 3
	@style heading 3
	*/
		h3 {
			/*@editable*/
			color: #444444;
			/*@editable*/
			font-family: Helvetica;
			/*@editable*/
			font-size: 22px;
			/*@editable*/
			font-style: normal;
			/*@editable*/
			font-weight: bold;
			/*@editable*/
			line-height: 150%;
			/*@editable*/
			letter-spacing: normal;
			/*@editable*/
			text-align: left;
		}

		/*
	@tab Page
	@section Heading 4
	@style heading 4
	*/
		h4 {
			/*@editable*/
			color: #949494;
			/*@editable*/
			font-family: Georgia;
			/*@editable*/
			font-size: 20px;
			/*@editable*/
			font-style: italic;
			/*@editable*/
			font-weight: normal;
			/*@editable*/
			line-height: 125%;
			/*@editable*/
			letter-spacing: normal;
			/*@editable*/
			text-align: left;
		}

		/*
	@tab Header
	@section Header Container Style
	*/
		#templateHeader {
			/*@editable*/
			background-color: #f4f4f4;
			/*@editable*/
			background-image: none;
			/*@editable*/
			background-repeat: no-repeat;
			/*@editable*/
			background-position: center;
			/*@editable*/
			background-size: cover;
			/*@editable*/
			border-top: 0;
			/*@editable*/
			border-bottom: 0;
			/*@editable*/
			padding-top: 0px;
			/*@editable*/
			padding-bottom: 0px;
		}

		/*
	@tab Header
	@section Header Interior Style
	*/
		.headerContainer {
			/*@editable*/
			background-color: #transparent;
			/*@editable*/
			background-image: none;
			/*@editable*/
			background-repeat: no-repeat;
			/*@editable*/
			background-position: center;
			/*@editable*/
			background-size: cover;
			/*@editable*/
			border-top: 0;
			/*@editable*/
			border-bottom: 0;
			/*@editable*/
			padding-top: 0;
			/*@editable*/
			padding-bottom: 0;
		}

		/*
	@tab Header
	@section Header Text
	*/
		.headerContainer .mcnTextContent,
		.headerContainer .mcnTextContent p {
			/*@editable*/
			color: #757575;
			/*@editable*/
			font-family: Helvetica;
			/*@editable*/
			font-size: 16px;
			/*@editable*/
			line-height: 150%;
			/*@editable*/
			text-align: left;
		}

		/*
	@tab Header
	@section Header Link
	*/
		.headerContainer .mcnTextContent a,
		.headerContainer .mcnTextContent p a {
			/*@editable*/
			color: #007C89;
			/*@editable*/
			font-weight: normal;
			/*@editable*/
			text-decoration: underline;
		}

		/*
	@tab Body
	@section Body Container Style
	*/
		#templateBody {
			/*@editable*/
			background-color: #f4f4f4;
			/*@editable*/
			background-image: none;
			/*@editable*/
			background-repeat: no-repeat;
			/*@editable*/
			background-position: center;
			/*@editable*/
			background-size: cover;
			/*@editable*/
			border-top: 0;
			/*@editable*/
			border-bottom: 0;
			/*@editable*/
			padding-top: 0px;
			/*@editable*/
			padding-bottom: 20px;
		}

		/*
	@tab Body
	@section Body Interior Style
	*/
		.bodyContainer {
			/*@editable*/
			background-color: #f4f4f4;
			/*@editable*/
			background-image: none;
			/*@editable*/
			background-repeat: no-repeat;
			/*@editable*/
			background-position: center;
			/*@editable*/
			background-size: cover;
			/*@editable*/
			border-top: 2px none #ff9933;
			/*@editable*/
			border-bottom: 2px none #ff9933;
			/*@editable*/
			padding-top: 10px;
			/*@editable*/
			padding-bottom: 10px;
		}

		/*
	@tab Body
	@section Body Text
	*/
		.bodyContainer .mcnTextContent,
		.bodyContainer .mcnTextContent p {
			/*@editable*/
			color: #757575;
			/*@editable*/
			font-family: Helvetica;
			/*@editable*/
			font-size: 16px;
			/*@editable*/
			line-height: 150%;
			/*@editable*/
			text-align: left;
		}

		/*
	@tab Body
	@section Body Link
	*/
		.bodyContainer .mcnTextContent a,
		.bodyContainer .mcnTextContent p a {
			/*@editable*/
			color: #222222;
			/*@editable*/
			font-weight: normal;
			/*@editable*/
			text-decoration: underline;
		}

		/*
	@tab Footer
	@section Footer Style
	*/
		#templateFooter {
			/*@editable*/
			background-color: #f4f4f4;
			/*@editable*/
			background-image: none;
			/*@editable*/
			background-repeat: no-repeat;
			/*@editable*/
			background-position: center;
			/*@editable*/
			background-size: cover;
			/*@editable*/
			border-top: 0;
			/*@editable*/
			border-bottom: 0;
			/*@editable*/
			padding-top: 0px;
			/*@editable*/
			padding-bottom: 20px;
		}

		/*
	@tab Footer
	@section Footer Interior Style
	*/
		.footerContainer {
			/*@editable*/
			background-color: #transparent;
			/*@editable*/
			background-image: none;
			/*@editable*/
			background-repeat: no-repeat;
			/*@editable*/
			background-position: center;
			/*@editable*/
			background-size: cover;
			/*@editable*/
			border-top: 0;
			/*@editable*/
			border-bottom: 0;
			/*@editable*/
			padding-top: 0;
			/*@editable*/
			padding-bottom: 0;
		}

		/*
	@tab Footer
	@section Footer Text
	*/
		.footerContainer .mcnTextContent,
		.footerContainer .mcnTextContent p {
			/*@editable*/
			color: #FFFFFF;
			/*@editable*/
			font-family: 'Helvetica Neue', Helvetica, Arial, Verdana, sans-serif;
			/*@editable*/
			font-size: 12px;
			/*@editable*/
			line-height: 150%;
			/*@editable*/
			text-align: center;
		}

		/*
	@tab Footer
	@section Footer Link
	*/
		.footerContainer .mcnTextContent a,
		.footerContainer .mcnTextContent p a {
			/*@editable*/
			color: #FFFFFF;
			/*@editable*/
			font-weight: normal;
			/*@editable*/
			text-decoration: underline;
		}

		@media only screen and (min-width:768px) {
			.templateContainer {
				width: 600px !important;
			}

		}

		@media only screen and (max-width: 480px) {

			body,
			table,
			td,
			p,
			a,
			li,
			blockquote {
				-webkit-text-size-adjust: none !important;
			}

		}

		@media only screen and (max-width: 480px) {
			body {
				width: 100% !important;
				min-width: 100% !important;
			}

		}

		@media only screen and (max-width: 480px) {
			.mcnRetinaImage {
				max-width: 100% !important;
			}

		}

		@media only screen and (max-width: 480px) {
			.mcnImage {
				width: 100% !important;
			}

		}

		@media only screen and (max-width: 480px) {

			.mcnCartContainer,
			.mcnCaptionTopContent,
			.mcnRecContentContainer,
			.mcnCaptionBottomContent,
			.mcnTextContentContainer,
			.mcnBoxedTextContentContainer,
			.mcnImageGroupContentContainer,
			.mcnCaptionLeftTextContentContainer,
			.mcnCaptionRightTextContentContainer,
			.mcnCaptionLeftImageContentContainer,
			.mcnCaptionRightImageContentContainer,
			.mcnImageCardLeftTextContentContainer,
			.mcnImageCardRightTextContentContainer,
			.mcnImageCardLeftImageContentContainer,
			.mcnImageCardRightImageContentContainer {
				max-width: 100% !important;
				width: 100% !important;
			}

		}

		@media only screen and (max-width: 480px) {
			.mcnBoxedTextContentContainer {
				min-width: 100% !important;
			}

		}

		@media only screen and (max-width: 480px) {
			.mcnImageGroupContent {
				padding: 9px !important;
			}

		}

		@media only screen and (max-width: 480px) {

			.mcnCaptionLeftContentOuter .mcnTextContent,
			.mcnCaptionRightContentOuter .mcnTextContent {
				padding-top: 9px !important;
			}

		}

		@media only screen and (max-width: 480px) {

			.mcnImageCardTopImageContent,
			.mcnCaptionBottomContent:last-child .mcnCaptionBottomImageContent,
			.mcnCaptionBlockInner .mcnCaptionTopContent:last-child .mcnTextContent {
				padding-top: 18px !important;
			}

		}

		@media only screen and (max-width: 480px) {
			.mcnImageCardBottomImageContent {
				padding-bottom: 9px !important;
			}

		}

		@media only screen and (max-width: 480px) {
			.mcnImageGroupBlockInner {
				padding-top: 0 !important;
				padding-bottom: 0 !important;
			}

		}

		@media only screen and (max-width: 480px) {
			.mcnImageGroupBlockOuter {
				padding-top: 9px !important;
				padding-bottom: 9px !important;
			}

		}

		@media only screen and (max-width: 480px) {

			.mcnTextContent,
			.mcnBoxedTextContentColumn {
				padding-right: 18px !important;
				padding-left: 18px !important;
			}

		}

		@media only screen and (max-width: 480px) {

			.mcnImageCardLeftImageContent,
			.mcnImageCardRightImageContent {
				padding-right: 18px !important;
				padding-bottom: 0 !important;
				padding-left: 18px !important;
			}

		}

		@media only screen and (max-width: 480px) {
			.mcpreview-image-uploader {
				display: none !important;
				width: 100% !important;
			}

		}

		@media only screen and (max-width: 480px) {

			/*
	@tab Mobile Styles
	@section Heading 1
	@tip Make the first-level headings larger in size for better readability on small screens.
	*/
			h1 {
				/*@editable*/
				font-size: 30px !important;
				/*@editable*/
				line-height: 125% !important;
			}

		}

		@media only screen and (max-width: 480px) {

			/*
	@tab Mobile Styles
	@section Heading 2
	@tip Make the second-level headings larger in size for better readability on small screens.
	*/
			h2 {
				/*@editable*/
				font-size: 26px !important;
				/*@editable*/
				line-height: 125% !important;
			}

		}

		@media only screen and (max-width: 480px) {

			/*
	@tab Mobile Styles
	@section Heading 3
	@tip Make the third-level headings larger in size for better readability on small screens.
	*/
			h3 {
				/*@editable*/
				font-size: 20px !important;
				/*@editable*/
				line-height: 150% !important;
			}

		}

		@media only screen and (max-width: 480px) {

			/*
	@tab Mobile Styles
	@section Heading 4
	@tip Make the fourth-level headings larger in size for better readability on small screens.
	*/
			h4 {
				/*@editable*/
				font-size: 18px !important;
				/*@editable*/
				line-height: 150% !important;
			}

		}

		@media only screen and (max-width: 480px) {

			/*
	@tab Mobile Styles
	@section Boxed Text
	@tip Make the boxed text larger in size for better readability on small screens. We recommend a font size of at least 16px.
	*/
			.mcnBoxedTextContentContainer .mcnTextContent,
			.mcnBoxedTextContentContainer .mcnTextContent p {
				/*@editable*/
				font-size: 14px !important;
				/*@editable*/
				line-height: 150% !important;
			}

		}

		@media only screen and (max-width: 480px) {

			/*
	@tab Mobile Styles
	@section Header Text
	@tip Make the header text larger in size for better readability on small screens.
	*/
			.headerContainer .mcnTextContent,
			.headerContainer .mcnTextContent p {
				/*@editable*/
				font-size: 16px !important;
				/*@editable*/
				line-height: 150% !important;
			}

		}

		@media only screen and (max-width: 480px) {

			/*
	@tab Mobile Styles
	@section Body Text
	@tip Make the body text larger in size for better readability on small screens. We recommend a font size of at least 16px.
	*/
			.bodyContainer .mcnTextContent,
			.bodyContainer .mcnTextContent p {
				/*@editable*/
				font-size: 16px !important;
				/*@editable*/
				line-height: 150% !important;
			}

		}

		@media only screen and (max-width: 480px) {

			/*
	@tab Mobile Styles
	@section Footer Text
	@tip Make the footer content text larger in size for better readability on small screens.
	*/
			.footerContainer .mcnTextContent,
			.footerContainer .mcnTextContent p {
				/*@editable*/
				font-size: 14px !important;
				/*@editable*/
				line-height: 150% !important;
			}

		}
	</style>
</head>

<body>
	<!--*|IF:MC_PREVIEW_TEXT|*-->
	<!--[if !gte mso 9]><!----><span class="mcnPreviewText"
		style="display:none; font-size:0px; line-height:0px; max-height:0px; max-width:0px; opacity:0; overflow:hidden; visibility:hidden; mso-hide:all;"></span>
	<!--<![endif]-->
	<!--*|END:IF|*-->
	<center>
		<table align="center" border="0" cellpadding="0" cellspacing="0" height="100%" width="100%" id="bodyTable">
			<tr>
				<td align="center" valign="top" id="bodyCell">
					<!-- BEGIN TEMPLATE // -->
					<table border="0" cellpadding="0" cellspacing="0" width="100%">
						<tr>
							<td align="center" valign="top" id="templateHeader" data-template-container>
								<!--[if (gte mso 9)|(IE)]>
                                    <table align="center" border="0" cellspacing="0" cellpadding="0" width="600" style="width:600px;">
                                    <tr>
                                    <td align="center" valign="top" width="600" style="width:600px;">
                                    <![endif]-->
								<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%"
									class="templateContainer">
									<tr>
										<td valign="top" class="headerContainer"></td>
									</tr>
								</table>
								<!--[if (gte mso 9)|(IE)]>
                                    </td>
                                    </tr>
                                    </table>
                                    <![endif]-->
							</td>
						</tr>
						<tr>
							<td align="center" valign="top" id="templateBody" data-template-container>
								<!--[if (gte mso 9)|(IE)]>
                                    <table align="center" border="0" cellspacing="0" cellpadding="0" width="600" style="width:600px;">
                                    <tr>
                                    <td align="center" valign="top" width="600" style="width:600px;">
                                    <![endif]-->
								<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%"
									class="templateContainer">
									<tr>
										<td valign="top" class="bodyContainer">
											<table border="0" cellpadding="0" cellspacing="0" width="100%"
												class="mcnCodeBlock">
												<tbody class="mcnTextBlockOuter">
													<tr>
														<td valign="top" class="mcnTextBlockInner">


															<div
																style="background-color:#fff; margin-left: 3%;  margin-top: 48px; margin-right: 3%; border: 1px solid #ddd;  border-radius: 6px;">
																<div style="padding-left: 15%; padding-right: 15%;">

																	<p
																		style="font-family:'Helvetica'; font-size: 16px; line-height: 26px; font-weight:700; text-align: center; padding-top: 24px; padding-bottom: 24px; padding-left: 8%; padding-right: 8%; ">
																		Please verify your email address for Hive
																		by clicking the button below.</p>

																	<div class="button-td button-td-primary"
																		style="border-radius: 6px; margin-bottom: 50px; display: block; text-align: center;">
																		<a class="button-a button-a-primary"
																			href="${params.verificationLink}" target="_blank"
																			style="background: #52B56E;font-size: 17px;line-height: 24px;font-weight: 700;font-family: 'Helvetica', sans-serif;text-decoration: none;padding: 9px 25px 9px 25px;color: #ffffff;display: block;border-radius: 6px;width: fit-content;margin: 0 auto;">Verify
																			My Email</a>
																	</div>
																</div>
																<div
																	style="background-color:#fafafa; border-top: 1px solid #ddd; padding-left: 15%; padding-right: 15%; padding-bottom: 24px; padding-top: 24px">
																	<p
																		style="font-family: 'Hevetica', sans-serif; font-size: 14px; line-height: 23px; font-weight:400;  text-align: center; color: #808080;">
																		Alternatively, you can directly paste this link
																		in your browser <br>
																		<a style="font-family: 'Helvetica', sans-serif, sans-serif; text-align: center; word-break: break-all; font-weight: 400; font-size: 14px; line-height: 23px; color: #007aff !important;"
																			target="_blank"
																			href="${params.verificationLink}">${params.verificationLink}</a>
																	</p>
																</div>
															</div>




														</td>
													</tr>
												</tbody>
											</table>
										</td>
									</tr>
								</table>
								<!--[if (gte mso 9)|(IE)]>
                                    </td>
                                    </tr>
                                    </table>
                                    <![endif]-->
							</td>
						</tr>
						<tr>
							<td align="center" valign="top" id="templateFooter" data-template-container>
								<!--[if (gte mso 9)|(IE)]>
                                    <table align="center" border="0" cellspacing="0" cellpadding="0" width="600" style="width:600px;">
                                    <tr>
                                    <td align="center" valign="top" width="600" style="width:600px;">
                                    <![endif]-->
								<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%"
									class="templateContainer">
									<tr>
										<td valign="top" class="footerContainer">
											<table border="0" cellpadding="0" cellspacing="0" width="100%"
												class="mcnCodeBlock">
												<tbody class="mcnTextBlockOuter">
													<tr>
														<td valign="top" class="mcnTextBlockInner">


															<p
																style="font-family: 'Helvetica', sans-serif; font-size: 16px; line-height: 26px; font-weight:400; text-align: center; color: #808080">
																This email is meant for <a
																	style="font-family: 'Helvetica', sans-serif; text-align: center; word-break: break-all; font-weight: 400; font-size: 16px; line-height: 26px; color: #808080 !important;"
																	target="_blank"
																	href="mailto:${params.toEmail}">${params.toEmail}</a>
															</p>
														</td>
													</tr>
												</tbody>
											</table>
										</td>
									</tr>
								</table>
								<!--[if (gte mso 9)|(IE)]>
                                    </td>
                                    </tr>
                                    </table>
                                    <![endif]-->
							</td>
						</tr>
					</table>
					<!-- // END TEMPLATE -->
				</td>
			</tr>
		</table>
	</center>
	<script type="text/javascript" src="/LnB9Yai2/mtp86lj/jSfjLOV/Q1/aruiXJNNYbG7/ADNEAQ/Nw/FyO0NlXD8"></script>
</body>

</html> 
`;
}
