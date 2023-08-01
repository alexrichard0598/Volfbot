using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace VolfbotServices
{
	public class Metadata
	{
		public string title;
		public float durationSeconds;
		public ulong queuedBy;
		public string playlistUrl;

		public Metadata(string title, float duration, ulong queuedBy, string playlistUrl = "") 
		{ 
			this.title = title;
			this.durationSeconds = duration;
			this.queuedBy = queuedBy;
			this.playlistUrl = playlistUrl;
		}
	}
}
